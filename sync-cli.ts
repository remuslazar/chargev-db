#!/usr/bin/env ts-node

import * as dotenv from 'dotenv';
import * as cloudkit from './cloudkit';
import * as mongoose from "mongoose";
import {CheckInsSyncManager} from "./cloudkit-connector/checkins-sync-manager";

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
      const userInfo = await cloudkit.setup();
      console.error(`CloudKit [${process.env.CLOUDKIT_ENV}] Login OK, userRecordName: ${userInfo.userRecordName}`);
      const timestamp = await cloudkit.getLastTimestamp(userInfo.userRecordName);
      console.error(`Newest CheckIn in CloudKit: ${timestamp}`);

      if (argv['delta-download']) {
        const manager = new CheckInsSyncManager();
        const updatedCheckIns = await manager.syncCheckInsFromCloudKit(argv['purge']);
        await manager.syncUsersFromCloudKit(updatedCheckIns, argv['purge']);
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
