#!/usr/bin/env ts-node

import * as dotenv from 'dotenv';
import * as mongoose from "mongoose";
import {CheckInsSyncManager} from "./cloudkit-connector/checkins-sync-manager";
import {CloudKitService} from "./cloudkit/cloudkit.service";

dotenv.config();
const argv = require('minimist')(process.argv.slice(2));
(mongoose as any).Promise = global.Promise;

/**
 * Connect to MongoDB.
 */
mongoose.connect(process.env.MONGODB_URI || 'mongodb://mongodb/ge', {
  useMongoClient: true,
});

const main = async () => {
  try {
    if (argv['cloudkit']) {
      const service = new CloudKitService();
      const userInfo = await service.setup();

      if (!userInfo) {
        // noinspection ExceptionCaughtLocallyJS
        throw new Error(`setup CloudKit failed`);
      }

      console.error(`CloudKit [${process.env.CLOUDKIT_ENV}] Login OK, userRecordName: ${userInfo.userRecordName}`);

      if (argv['purge']) {
        const manager = new CheckInsSyncManager(service, argv['dry-run']);
        await manager.purgeCheckInsInCloudKitOriginallySynchronizedFromLocalDatabase();
      }

      if (argv['delta-download']) {
        const timestamp = await service.getchargEVCheckInLastTimestamp();
        console.error(`Newest CheckIn in CloudKit: ${timestamp}`);

        const manager = new CheckInsSyncManager(service, argv['dry-run']);
        const updatedCheckIns = await manager.syncCheckInsFromCloudKit(argv['purge']);
        if (updatedCheckIns.length > 0) {
          await manager.syncUsersFromCloudKit(updatedCheckIns, argv['purge']);
        }
      }

      if (argv['delta-upload']) {
        console.log(`CloudKit Delta-Upload`);
        const manager = new CheckInsSyncManager(service, argv['dry-run']);
        await manager.createCheckInsInCloudKitForNewChargeEvents();
      }

    }

    process.exit()
  } catch(err) {
    console.error(err);
    process.exit(1)
  }
};

main().then(() => {

}, err => {
  console.error(err);
});
