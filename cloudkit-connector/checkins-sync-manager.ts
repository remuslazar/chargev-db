import {
  allSourcesOtherThanChargEVSource, ChargeEvent,
  ChargeEventSource,
  CheckIn,
  CKCheckIn,
  ICheckIn, ILadelog, Ladelog,
} from "../app/models/chargeevent.model";
import {CKUser, getCKUserFromCKRecord} from "../app/models/ck-user.model";
import * as CloudKit from "../cloudkit/vendor/cloudkit";
import {CloudKitService} from "../cloudkit/cloudkit.service";
import {
  ChargepointInfo,
  ChargepointRef,
  CKCheckInFromLadelog,
  CKCheckInReason, EVPlugFinderRegistry,
  GEChargepoint
} from "./evplugfinder.model";
import {GoingElectricFetcher} from "../GE/GoingElectricFetcher";
import {Chargelocation} from "../GE/api.interface";

export class CheckInsSyncManager {

  protected goingElectricFetcher: GoingElectricFetcher;

  constructor(private service: CloudKitService, private dryRun: boolean) {
    if (!process.env.GE_API_KEY) {
      throw new Error(`GE API Key not configured`);
    }
    this.goingElectricFetcher = new GoingElectricFetcher(<string>process.env.GE_API_KEY)
  }

  private getCheckInFromCKRecord(record: any) {

    function getValue(fieldName: string) {
      if (fieldName in record.fields) {
        return record.fields[fieldName].value;
      }
      return null;
    }

    return <CheckIn>{
      recordName: record.recordName,
      recordChangeTag: record.recordChangeTag,
      created: record.created,
      modified: record.modified,
      deleted: record.deleted,
      source: getValue('source') || ChargeEventSource.cloudKit,
      timestamp: new Date(getValue('timestamp')),
      reason: getValue('reason'),
      comment: getValue('comment'),
      plug: getValue('plug'),
      chargepoint: getValue('chargepoint').recordName,
    };
  }

  private async syncDeletedCheckInsFromCloudKit(newestTimestamp: number): Promise<void> {

    const getChangedChargepointsRefs = async (newestTimestamp: number): Promise<any[]> => {
      const query = {
        recordType: 'Chargepoints',
        filterBy: [
          {
            fieldName: "___modTime",
            comparator: CloudKit.QueryFilterComparator.GREATER_THAN,
            fieldValue: {value: newestTimestamp},
          }
        ],
      };

      const options = {
        desiredKeys: [ ] // we do only need the recordName, no other info
      };

      const chargepointRefs: any[] = [];

      await this.service.find(query, options, async (records: any[]) => {
        // console.log(JSON.stringify(records, null, 4));
        for (let record of records) {
          chargepointRefs.push(record.recordName);
        }
      });

      return chargepointRefs;
    };

    const getCheckInRecordNames = async (chargepoints: string[]): Promise<string[]> => {
      const query = {
        recordType: 'CheckIns',
        filterBy: [
          {
            comparator: CloudKit.QueryFilterComparator.IN,
            fieldName: "chargepoint",
            fieldValue: {
              value: chargepoints.map($0 => <any>{recordName: $0}),
            },
          }
        ],
      };

      const options = {
        desiredKeys: [ ] // we do only need the recordName, no other info
      };

      const recordNames: string[] = [];

      await this.service.find(query, options, async (records: any[]) => {
        // console.log(JSON.stringify(records, null, 4));
        for (let record of records) {
          recordNames.push(record.recordName);
        }
      });

      return recordNames;
    };

    const chargepointRefs = await getChangedChargepointsRefs(newestTimestamp);

    if (chargepointRefs.length === 0) {
      // nothing to do
      return;
    }

    const checkInsFromCloudKitRecordNames = await getCheckInRecordNames(chargepointRefs);
    const checkInsInLocalDatabase = await CKCheckIn.find({chargepoint: {$in: chargepointRefs}, deleted: false}, {recordName: 1});
    const checkInRecordNamesInLocalDatabase = new Set(checkInsInLocalDatabase.map(checkIn => checkIn.recordName));

    // we remove all items which do exists in cloudkit
    checkInsFromCloudKitRecordNames.forEach($0 => checkInRecordNamesInLocalDatabase.delete($0));

    // and then set the remaining entries as deleted
    let checkRecordNamesToDelete = Array.from(checkInRecordNamesInLocalDatabase);

    if (checkRecordNamesToDelete.length === 0) {
      return;
    }

    await CKCheckIn.update({ recordName: { $in: checkRecordNamesToDelete } }, {deleted: true, updatedAt: Date.now()}, {multi: true});
    console.log(`Set ${checkRecordNamesToDelete.length} record(s) as deleted: [${checkRecordNamesToDelete.join(',')}]`);
  };

  public async syncCheckInsFromCloudKit(purge = false): Promise<ICheckIn[]> {

    if (purge) {
      await CKCheckIn.remove({});
    }
    const newestCheckIn = await CKCheckIn.findOne({source: ChargeEventSource.cloudKit }, {}, {sort: {'modified.timestamp': -1}});
    const newestTimestamp = newestCheckIn ? newestCheckIn.modified.timestamp : 0;

    const query = {
      recordType: 'CheckIns',
      filterBy: <any>[],
      sortBy: [
        { systemFieldName: "modifiedTimestamp", ascending: true },
      ],
    };

    const options = {};

    query.filterBy.push({
      fieldName: "source",
      comparator: CloudKit.QueryFilterComparator.NOT_IN,
      fieldValue: { value: allSourcesOtherThanChargEVSource }
    });

    if (newestTimestamp) {
      query.filterBy.push({
        // @see https://forums.developer.apple.com/thread/28126
        systemFieldName: "modifiedTimestamp",
        comparator: CloudKit.QueryFilterComparator.GREATER_THAN,
        fieldValue: { value: newestTimestamp },
      });
    }

    const updatedCheckIns: any[] = [];

    await this.service.find(query, options, async (records: any[]) => {
      // console.log(JSON.stringify(records, null, 4));
      let count = 0;
      for (let record of records) {
        const checkIn = this.getCheckInFromCKRecord(record);
        updatedCheckIns.push(checkIn);
        await CKCheckIn.findOneAndUpdate({recordName: record.recordName}, checkIn, {upsert: true});
        count++;
      }
      if (count) {
        console.log('Sync CloudKit CheckIns: %d record(s) processed.', count);
      } else {
        console.log(`No new CheckIns in CloudKit available for download, nothing to do.`);
      }
    });

    if (!purge && newestTimestamp) {
      await this.syncDeletedCheckInsFromCloudKit(newestTimestamp);
    }

    return updatedCheckIns;
  };

  public async syncUsersFromCloudKit(checkIns: ICheckIn[], purge = false): Promise<void> {

    if (purge) {
      await CKUser.remove({});
    }

    const allUserRecordNames = new Set(checkIns.map(checkIn => checkIn.modified.userRecordName));

    await this.service.get(Array.from(allUserRecordNames).map($0 => { return { recordType: 'User', recordName: $0}}),
        {}, async (records: any[]) => {
      // console.log(JSON.stringify(records, null, 4));
      let count = 0;
      for (let record of records) {
        const user = getCKUserFromCKRecord(record);
        await CKUser.findOneAndUpdate({recordName: record.recordName}, user, {upsert: true});
        count++;
      }
      console.log('Sync CloudKit User Records: %d record(s) processed.', count);
    });
  };

  private async getChargePointDetails(ref: ChargepointRef): Promise<Chargelocation> {
    const chargepointInfo = new ChargepointInfo(ref);

    if (chargepointInfo.registry !== EVPlugFinderRegistry.goingElectric) {
      throw new Error(`currently we support only the GoingElectric registry`);
    }

    const chargepoints = await this.goingElectricFetcher.fetchChargepoints([chargepointInfo.id]);

    if (!chargepoints || chargepoints.length === 0) {
      throw new Error(`could not fetch chargepoint details for going electric chargepoing with ge_id: ${chargepointInfo.id}`);
    }
    return chargepoints[0];
  }

  protected async createCheckInForLadelog(ladelog: ILadelog) {
    const chargepointRef = new ChargepointRef(ladelog.chargepoint);

    try {
      const chargepointDetails = await this.getChargePointDetails(chargepointRef);
      const lastCheckIn = await this.service.getLastCheckIn(chargepointRef);
      const ckCheckInToInsert = new CKCheckInFromLadelog(ladelog, chargepointDetails);

      // check if the lastCheckin is newer than the CheckIn we want to insert
      if (lastCheckIn && lastCheckIn.fields.timestamp && lastCheckIn.fields.timestamp.value >= ckCheckInToInsert.fields.timestamp.value) {
        console.log(`Last CheckIn for ${chargepointRef.value.recordName} is newer than the CheckIn we want to insert. Skipping..`);
        return;
      }

      // Check if the last CheckIn is already positive and the new checkin we want to insert as well,
      // then do NOT insert the new checkIn to avoid multiple redundant entries.
      if (lastCheckIn && lastCheckIn.fields.source &&
          lastCheckIn.fields.source.value === ChargeEventSource.goingElectric &&
          lastCheckIn.fields.reason.value === CKCheckInReason.ok &&
          ckCheckInToInsert.fields.reason.value === CKCheckInReason.ok
      ) {
        console.log(`Warning: Last (GE) CheckIn for ${chargepointRef.value.recordName} is positive, NOT creating another positive CheckIn in this case.`);
        return;
      }

      const ckChargePointToUpsert = new GEChargepoint(chargepointDetails, ckCheckInToInsert, lastCheckIn);

      if (this.dryRun) {
        console.log(`DRY RUN: New ${ckCheckInToInsert} for ${ckChargePointToUpsert}`);
        return;
      }

      const existinCKChargePoint = await this.service.getChargePoint(chargepointRef);

      if (existinCKChargePoint) {
        ckChargePointToUpsert.recordChangeTag = existinCKChargePoint.recordChangeTag;
      }

      await this.service.saveRecords([ckCheckInToInsert, ckChargePointToUpsert]);
      console.log(`New ${ckCheckInToInsert} for ${ckChargePointToUpsert} created.`);
    } catch (err) {
      console.log(`ERROR: ${err.message}. CheckIn skipped.`)
    }
  }

  /**
   * Create new CheckIns in the CloudKit Backend for all new ChargeEvent's in the local database
   *
   * This means:
   *
   *   - chargEV Users will see the synchronized ChargeEvent records as regular CheckIns in the event list
   *   - chargEV Users will be notified per Push if appropriate (state transition occurred, chargestation is favorite)
   *
   */
  public async createCheckInsInCloudKitForNewChargeEvents() {
    // fetch the timestamp of the last inserted chargeevent, so we can perform a delta upload
    let timestampOfLastInsertedRecord =
        await this.service.getLastTimestampOfSynchronizedRecord(allSourcesOtherThanChargEVSource);

    if (timestampOfLastInsertedRecord) {
      console.log(`Newest timestamp of synchronized CheckIn from local database in CloudKit: ${timestampOfLastInsertedRecord.toISOString()}`);
    }

    const conditions = <any>{
      source: {$ne: ChargeEventSource.cloudKit},
    };

    if (timestampOfLastInsertedRecord) {
      conditions['updatedAt'] = {$gt: timestampOfLastInsertedRecord};
    }

    const events = await ChargeEvent
        .find(conditions)
        .sort({updatedAt: 1});

    for(let event of events) {
      if (event instanceof Ladelog) {
        const ladelog = <ILadelog>event.toObject();
        await this.createCheckInForLadelog(ladelog);
      } else if (event instanceof CheckIn) {
        console.log(`checkin`);
      }
    }

    return events.length;
  }

  /**
   * Purge all available records in CloudKit which originally were synchronized from the local database
   *
   * Useful for debugging or maintenance.
   *
   * @returns {Promise<void>}
   */
  public async purgeCheckInsInCloudKitOriginallySynchronizedFromLocalDatabase() {
    await this.service.find({
      recordType: 'CheckIns',
      filterBy: [
        {
          systemFieldName: 'createdUserRecordName',
          comparator: CloudKit.QueryFilterComparator.EQUALS,
          fieldValue: {
            value: {
              recordName: this.service.userRecordName,
            }
          }
        },
        {
          fieldName: "source",
          comparator: CloudKit.QueryFilterComparator.IN,
          fieldValue: {value: allSourcesOtherThanChargEVSource},
        }
      ],
    }, {desiredKeys: ['recordName']}, async (records: any[]) => {
      if (records.length > 0) {
        await this.service.delete(records.map($0 => $0.recordName));
        console.log(`${records.length} record(s) deleted`);
      }
    });
  }

}
