import {Document, Model, model, Schema} from 'mongoose';
import {CKRecord} from "./cloudkit.types";

export interface MongooseTimestamps {
  createdAt: Date;
  updatedAt: Date;
}

export enum ChargeEventSource {
  // noinspection JSUnusedGlobalSymbols
  cloudKit = 0,
  goingElectric = 1,
}

export interface ChargeEventBase extends MongooseTimestamps {
  source: ChargeEventSource;
  upstreamUpdatedAt: Date;
  timestamp: Date;
  chargepoint: string; // e.g. chargepoint-0-3358
  comment: string;
  nickname?: string;
  userID?: string;
}

export interface ChargeEventFault {
  source: number;
  deleted: true;
}

export interface CheckIn extends ChargeEventBase {
  reason: number;
  plug?: string;
}

export interface CKCheckIn extends CKRecord, ChargeEventBase {
  reason: number;
  plug?: string;
}

export interface Ladelog extends ChargeEventBase {
  isFault: boolean;
}

export interface ICheckIn extends CheckIn, Document {
}

export interface ICKCheckIn extends CKCheckIn, Document {
}

export interface IChargeEventBase extends ChargeEventBase, Document {
}

export interface ILadelog extends Ladelog, Document {
}

export interface IChargeEventFault extends ChargeEventFault, Document {
}

// noinspection JSUnusedGlobalSymbols
const chargeEventSchema = new Schema({
  source: { type: Number, index: true, required: true },
  timestamp: { type: Date, index: true, required: true },
  upstreamUpdatedAt: { type: Date, index: true, required: true, default: Date.now },
  chargepoint: { type: String, index: true, required: true, validate: {
      validator: function(v: string) {
        return /^chargepoint-\d+-\d+$/.test(v);
      },
      message: '"{VALUE}" is not a valid chargepoint reference.'
    }
  },
  comment: String,
  nickname: String,
}, {timestamps: true});

chargeEventSchema.index({'updatedAt': 1});

chargeEventSchema.set('toObject', {
  transform: (doc: any, ret: IChargeEventBase) => {
    delete ret._id;
    delete ret.createdAt;

    return ret;
  }
});

export const cloudkitCheckInSchema = new Schema({
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
  reason: Number,
  plug: String,
  nickname: String,
  userID: { type: String, index: true },
});

export const checkInSchema = new Schema({
  deleted: Boolean,
  reason: { type: Number, required: true, min: 10, max: 1000 },
  plug: { type: String, required: false, enum: [
      'Type1',
      'Type2',
      'CHAdeMO',
      'CCS',
      'CEEBlau',
      'CEERot',
      'Schuko',
      'TeslaSupercharger',
    ] },
  nickname: { type: String, required: false },
  userID: { type: String, required: false },
});

chargeEventSchema.set('toObject', {virtuals: true});

// for CheckIns we resolve the userID from the associated user record identifier
cloudkitCheckInSchema.path('userID').get(function (this: any) {
  return this.user ? this.user.recordName : undefined;
});

cloudkitCheckInSchema.set('toObject', {
  transform: (doc: any, ret: ICKCheckIn) => {
    delete ret._id;
    delete ret.createdAt;

    delete ret.recordChangeTag;
    delete ret.created;
    delete ret.modified;
    delete ret.recordName;

    return ret;
  }
});

const ladelogSchema = new Schema({
  isFault: Boolean,
  nickname: String,
});

ladelogSchema.set('toObject', {
  transform: (doc: any, ret: ILadelog) => {
    delete ret._id;
    delete ret.createdAt;

    return ret;
  }
});

// for "Ladelogs" from GoingElectric we currently do use a hardcoded nickname
ladelogSchema.path('nickname').get(function (this: any) {
  return 'GoingElectric';
});

const chargeEventFault = new Schema({
  deleted: Boolean,
});

export const ChargeEvent: Model<IChargeEventBase> = model<IChargeEventBase>('ChargeEvent', chargeEventSchema);
export const CKCheckIn: Model<ICKCheckIn> = ChargeEvent.discriminator('CKCheckIn', cloudkitCheckInSchema);
export const CheckIn: Model<ICheckIn> = ChargeEvent.discriminator('CheckIn', checkInSchema);
export const Ladelog: Model<ILadelog> = ChargeEvent.discriminator('Ladelog', ladelogSchema);
// deleted records will be of this type
// noinspection JSUnusedGlobalSymbols
export const ChargeEventFault: Model<IChargeEventFault> = ChargeEvent.discriminator('ChargeEventFault', chargeEventFault);
