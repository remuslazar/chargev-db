process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

let container, database;

const setup = function () {
  const containerConfig = require('./config');

  const CloudKit = require('./vendor/cloudkit');
  const fetch = require('node-fetch');

  //CloudKit configuration
  CloudKit.configure({
    services: {
      fetch: fetch
      //, logger: console
    },
    containers: [containerConfig]
  });

  container = CloudKit.getDefaultContainer();
  database = container.publicCloudDatabase; // We'll only make calls to the public database.

  return container.setUpAuth();
};

const saveRecords = function(records) {
  return database.saveRecords(records);
};

const deleteRecords = function(records) {
  return database.deleteRecords(records);
};

const find = async function performQuery(query, options, cb) {
  const limit = options.resultsLimit;
  let response = await database.performQuery(query, options);
  let totalCount = response.records.length;
  await cb(response.records);
  while (response.moreComing) {
    if (limit && totalCount >= limit) {
      break;
    }
    response = await database.performQuery(response);
    totalCount += response.records.length;
    await cb(response.records);
  }
};

const get = async function fetchRecords(recordNames, options, cb) {
  try {
    let response = await database.fetchRecords(
        recordNames.map(function(recordName) { return { recordName: recordName}; }),
        options);
    await cb(response.records);
  } catch (error) {
    if (error.ckErrorCode === 'BAD_REQUEST' && recordNames.length >= 2) {
      // BadRequestException: array 'records' length is greater than max size
      const howMany = recordNames.length / 2;
      // split the records array in half and recurse
      const remaining = recordNames.splice(0, howMany);
      await fetchRecords(recordNames, options, cb);
      await fetchRecords(remaining, options, cb);
    } else {
      throw error;
    }
  }
};

/**
 * Get the timestamp of the most recent "goingElectricSync" CKCheckIn
 *
 * The timestamp is being used for the sync update logic
 *
 * @param userRecordName
 */
const getLastTimestamp = function (userRecordName) {
  return database.performQuery({
    recordType: 'CheckIns',
    filterBy: [
      {
        systemFieldName: "createdUserRecordName",
        comparator: "EQUALS",
        fieldValue: {
          value: {
            recordName: userRecordName
          },
          type: "REFERENCE"
        }
      },
      {
        fieldName: "source",
        comparator: "EQUALS",
        fieldValue: { value: 1 } // CKCheckInSource.goingElectricSync
      }
    ],
    sortBy: [
      {
        systemFieldName: "createdTimestamp",
        ascending: false
      }
    ]
  }, { resultsLimit: 1 }).then(function (response) {
    return response.records.length ? new Date(response.records[0].created.timestamp) : null;
  })
};

const getLastCheckIn = function(chargepointRef) {
  return database.performQuery({
    recordType: 'CheckIns',
    filterBy: [
      {
        fieldName: "chargepoint",
        comparator: "EQUALS",
        fieldValue: chargepointRef
      }
    ],
    sortBy: [
      {
        fieldName: "timestamp",
        ascending: false
      }
    ]
  }, { resultsLimit: 1 }).then(function (response) {
    return response.records.length ? response.records[0] : null;
  })
};

const getCheckIns = function(newerThanTimestamp, limit, all, cb) {
  const options = {};
  if (newerThanTimestamp instanceof Date) {
    newerThanTimestamp = newerThanTimestamp.getTime();
  }
  if (limit !== undefined) { options.resultsLimit = limit; }

  const filterBy = [];
  if (!all) {
    filterBy.push({
      fieldName: "source",
      comparator: "NOT_EQUALS",
      fieldValue: { value: 1 } // CKCheckInSource.goingElectricSync
    });
  }
  if (newerThanTimestamp) {
    filterBy.push({
      fieldName: "timestamp",
      comparator: "GREATER_THAN",
      fieldValue: { value: newerThanTimestamp }
    });
  }

  return find({
    recordType: 'CheckIns',
    filterBy: filterBy,
    sortBy: [
      {
        fieldName: "timestamp",
        ascending: true
      }
    ]
  }, options, cb);
};

const getCheckInsForUser = function(userRecordName, cb) {
  return find({
    recordType: 'CheckIns',
    filterBy: [
      {
        systemFieldName: "createdUserRecordName",
        comparator: "EQUALS",
        fieldValue: {
          value: {
            recordName: userRecordName
          },
          type: "REFERENCE"
        }
      },
      {
        fieldName: "source",
        comparator: "EQUALS",
        fieldValue: { value: 1 } // CKCheckInSource.goingElectricSync
      }
    ]
  }, { desiredKeys: [] }, cb);
};

const getChargePoint = function(chargepointRef) {
  return database.fetchRecords(chargepointRef.value.recordName).then(function(response) {
    if (response.hasErrors) {
      //throw response.errors[0];
      return null;
    } else {
      return response.records ? response.records[0] : null;
    }
  });
};

module.exports = {
  setup: setup,
  getLastTimestamp: getLastTimestamp,
  saveRecords: saveRecords,
  deleteRecords: deleteRecords,
  getLastCheckIn: getLastCheckIn,
  getChargePoint: getChargePoint,
  getCheckInsForUser: getCheckInsForUser,
  getCheckIns: getCheckIns,
  find: find,
  get: get
};
