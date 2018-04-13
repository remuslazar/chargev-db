export interface CKTimestamp {
  timestamp: number; // miliseconds after 1.1.70 UTC
  userRecordName: string;
  deviceID: string;
}

export interface CKRecord {
  recordName: string;
  recordChangeTag: string;
  deleted: boolean
  created: CKTimestamp;
  modified: CKTimestamp;
}

export interface CKLocation {
  latitude: number;
  longitude: number;
}
