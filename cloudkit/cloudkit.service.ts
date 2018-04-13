import {cloudkitContainerConfig} from "./cloudkit.config";
import * as CloudKit from "./vendor/cloudkit";
import {allSourcesOtherThanChargEVSource, ChargeEventSource} from "../app/models/chargeevent.model";
import {CKRef} from "../app/models/cloudkit.types";
import {CKRecordUpsert} from "../cloudkit-connector/evplugfinder.model";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

export class CloudKitService {

  private container: any;
  private database: any;

  // currently logged in user (server-to-server)
  protected userRecordName: string|null = null;

  async setup() {
    const fetch = require('node-fetch');

    //CloudKit configuration
    CloudKit.configure({
      services: {
        fetch: fetch,
        // logger: console,
      },
      containers: [ cloudkitContainerConfig ]
    });

    this.container = CloudKit.getDefaultContainer();
    this.database = this.container.publicCloudDatabase; // We'll only make calls to the public database.

    const userInfo = await this.container.setUpAuth();
    this.userRecordName = userInfo.userRecordName;
    return userInfo;
  };

  async getChargePoint(chargepointRef: CKRef) {
    const response = await this.database.fetchRecords(chargepointRef.value.recordName);

    if (response.hasErrors) {
      //throw response.errors[0];
      return null;
    } else {
      return response.records ? response.records[0] : null;
    }
  };

  async saveRecords(records: CKRecordUpsert[]) {
    return this.database.saveRecords(records);
  };

  async getLastCheckIn(ref: CKRef) {
    const response = await this.database.performQuery({
      recordType: 'CheckIns',
      filterBy: [
        {
          fieldName: "chargepoint",
          comparator: "EQUALS",
          fieldValue: ref
        }
      ],
      sortBy: [
        {
          fieldName: "timestamp",
          ascending: false
        }
      ]
    }, { resultsLimit: 1 });

    return response.records.length ? response.records[0] : null;
  };

  /**
   * Retrieves the latest timestamp of last inserted record for the specified sources
   *
   * Note: this query will only filter out own records, inserted via server-to-server auth. Especially
   * this will not handle any user created records!
   *
   * @param {ChargeEventSource[]} sources
   * @returns {Promise<Date|null>}
   */
  async getLastTimestampOfSynchronizedRecord(sources: ChargeEventSource[]) {
    return await this.database.performQuery({
      recordType: 'CheckIns',
      filterBy: [
        {
          systemFieldName: 'createdUserRecordName',
          comparator: CloudKit.QueryFilterComparator.EQUALS,
          fieldValue: {
            value: {
              recordName: this.userRecordName,
            }
          }
        },
        {
          fieldName: "source",
          comparator: CloudKit.QueryFilterComparator.IN,
          fieldValue: { value: sources },
        }
      ],
      sortBy: [
        {
          fieldName: "modified",
          ascending: false
        }
      ],
    }, { resultsLimit: 1 }).then(function (response: any) {
      return response.records.length && response.records[0].fields.modified ? new Date(response.records[0].fields.modified.value) : null;
    })
  };

  /**
   * Retrieves the latest timestamp of the last chargEV user generated CheckIn
   *
   * Note: this query will filter out any other "mirrored" records of other sources
   *
   * @returns {Promise<any>}
   */
  async getchargEVCheckInLastTimestamp() {
    return await this.database.performQuery({
      recordType: 'CheckIns',
      filterBy: [
        {
          fieldName: "source",
          comparator: CloudKit.QueryFilterComparator.NOT_IN,
          fieldValue: { value: allSourcesOtherThanChargEVSource },
        }
      ],
      sortBy: [
        {
          systemFieldName: "modifiedTimestamp",
          ascending: false
        }
      ],
    }, { resultsLimit: 1 }).then(function (response: any) {
      return response.records.length ? new Date(response.records[0].created.timestamp) : null;
    })
  };

  async find(query: any, options: any, cb: any) {
    const limit = options.resultsLimit;
    let response = await this.database.performQuery(query, options);
    let totalCount = response.records.length;
    await cb(response.records);
    while (response.moreComing) {
      if (limit && totalCount >= limit) {
        break;
      }
      response = await this.database.performQuery(response);
      totalCount += response.records.length;
      await cb(response.records);
    }
  };

  async get(recordNames: any[], options: any, cb: any) {
    try {
      let response = await this.database.fetchRecords(
          recordNames, options);
      await cb(response.records);
    } catch (error) {
      if (error.ckErrorCode === 'BAD_REQUEST' && recordNames.length >= 2) {
        // BadRequestException: array 'records' length is greater than max size
        const howMany = recordNames.length / 2;
        // split the records array in half and recurse
        const remaining = recordNames.splice(0, howMany);
        await this.get(recordNames, options, cb);
        await this.get(remaining, options, cb);
      } else {
        throw error;
      }
    }
  };
}
