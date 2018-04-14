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
      const manager = new CheckInsSyncManager(service, {
        dryRun: argv['dry-run'],
        limit: argv.limit ? parseFloat(argv.limit) : undefined }
      );

      if (argv['purge']) {
        console.log(`CloudKit purge existing records..`);
        await manager.purgeCheckInsInCloudKitOriginallySynchronizedFromLocalDatabase();
      }

      if (argv['delta-download']) {
        console.log(`# CloudKit Delta-Download`);
        const timestamp = await service.getchargEVCheckInLastTimestamp();
        console.error(`Newest CheckIn (from chargEV Users) in CloudKit: ${timestamp}`);

        const updatedCheckIns = await manager.syncCheckInsFromCloudKit(argv['purge']);
        if (updatedCheckIns.length > 0) {
          await manager.syncUsersFromCloudKit(updatedCheckIns, argv['purge']);
        }
      }

      if (argv['delta-upload']) {
        console.log(`# CloudKit Delta-Upload`);
        const totalCount = await manager.createCheckInsInCloudKitForNewChargeEvents();
        if (totalCount > 0) {
          console.log(`${totalCount} CheckIn(s) uploaded to CloudKit`);
        } else {
          console.log(`No new CheckIns for upload to CloudKit available, nothing to do.`);
        }
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
