import * as CloudKit from 'tsl-apple-cloudkit';
import {Container, Database, Query, RecordLike} from "tsl-apple-cloudkit";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

export class CloudKitService {

  private container: Container;
  private database: Database;

  setup() {
    const containerConfig = require('./config');

    const fetch = require('node-fetch');

    //CloudKit configuration
    CloudKit.configure({
      services: {
        fetch: fetch,
        // logger: console,
      },
      containers: [containerConfig]
    });

    this.container = (<any>CloudKit).getDefaultContainer();
    this.database = this.container.publicCloudDatabase; // We'll only make calls to the public database.

    return this.container.setUpAuth();
  };

  getLastTimestamp(userRecordName: string) {
    return this.database.performQuery({
      recordType: 'CheckIns',
      filterBy: [
        {
          systemFieldName: 'createdUserRecordName',
          comparator: CloudKit.QueryFilterComparator.EQUALS,
          fieldValue: {
            value: {
              recordName: userRecordName,
            }
          }
        },
        {
          fieldName: "source",
          comparator: CloudKit.QueryFilterComparator.EQUALS,
          fieldValue: { value: 1 } // CKCheckInSource.goingElectricSync
        }
      ]
    }, { resultsLimit: 1 }).then(function (response) {
      return response.records.length ? new Date(response.records[0].created.timestamp) : null;
    })
  };

  async find(query: Query, options: any, cb: any) {
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


  async get(recordNames: RecordLike[], options: any, cb: any) {
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