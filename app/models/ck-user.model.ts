import {Document, model, Model, Schema} from 'mongoose';
import {CKRecord} from "./cloudkit.types";

interface CKUser extends CKRecord {
  nickname?: string;
}

export interface ICKUser extends CKUser, Document {}

const ckUserSchema = new Schema({
  // CKRecord
  recordChangeTag: String,
  deleted: Boolean,
  created: {
    timestamp: { type: Number, index: true },
    userRecordName: String,
    deviceID: String,
  },
  modified: {
    timestamp: { type: Number, index: true },
    userRecordName: String,
    deviceID: String,
  },
  recordName: { type: String, index: true },

  // CKUser
  nickname: String,
});

export const CKUser: Model<ICKUser> = model<ICKUser>('CKUser', ckUserSchema);
