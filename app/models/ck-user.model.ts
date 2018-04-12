import {Document, model, Model, Schema} from 'mongoose';
import {CKRecord} from "./cloudkit.types";

interface CKUser extends CKRecord {
  nickname?: string;
}

export interface ICKUser extends CKUser, Document {}

export function getCKUserFromCKRecord(record: any): CKUser {

  function getValue(fieldName: string) {
    if (fieldName in record.fields) {
      return record.fields[fieldName].value;
    }
    return null;
  }

  return {
    recordName: record.recordName,
    recordChangeTag: record.recordChangeTag,
    created: record.created,
    modified: record.modified,
    deleted: record.deleted,
    nickname: getValue('nickname'),
  };
}

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
