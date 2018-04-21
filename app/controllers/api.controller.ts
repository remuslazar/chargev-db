import {NextFunction, Request, Response, Router} from "express";
import {Error} from "../server";
import {ChargeEvent, CheckIn, CKCheckIn, Ladelog} from "../models/chargeevent.model";
import {AppRequest, jwtAuth} from "../auth/jwt-auth.middleware";
import {Model, ValidationError} from "mongoose";
import {ObjectID} from "bson";
import {APIClientInfo} from "../auth/jwt-auth.service";

/** maximum record count for a single REST call */
const MAX_RECORD_COUNT = 200;

const router: Router = Router();

router.use(jwtAuth);

const setReadACLs = (clientInfo: APIClientInfo, conditions: any[]) => {
  const sourcesFilter: Array<number | null> | undefined = clientInfo.acl.sources;

  // hack: for various reasons the source=0 checkins do not have any source value, so just use also null as a valid source
  if (sourcesFilter && sourcesFilter.indexOf(0) !== -1) { sourcesFilter.push(null); }

  if (sourcesFilter) {
    conditions.push({ source: sourcesFilter });
  }

  // additionally, all API clients can access sources < 1000 if the own source is < 1000
  // The reason: sources >= 1000 are being used for development
  if (clientInfo.source < 1000) {
    conditions.push({source: {$lt: 1000}});
  }
};

const setWriteACLs = (clientInfo: APIClientInfo, conditions: any[]) => {
  const source = clientInfo.source;
  if (source === undefined) {
    // noinspection ExceptionCaughtLocallyJS
    throw new Error('no source configured');
  }
  conditions.push({source: source, deleted: {$ne: true}});
};

// API endpoints
router.get('/events', async (req: AppRequest, res: Response, next: NextFunction) => {

  const conditions: any[] = [];

  setReadACLs(req.clientInfo, conditions);

  // changed-since option
  if (req.query['changed-since'] || req.query['change-token']) {

    let changedSinceOption = req.query['changed-since'];
    if (changedSinceOption && changedSinceOption.match(/^\d+$/)) {
      changedSinceOption = parseFloat(changedSinceOption);
    }

    const changedSince = new Date(changedSinceOption || parseFloat(req.query['change-token']));
    conditions.push({ updatedAt: { $gt: changedSince }});

    // select only those deleted records from the past, so the client can delete them. Newer deleted records do not
    // matter. The only reason we send deleted records is that the client can also delete them from his cache.
    conditions.push({
      $or: [
        {
          // new record (from the client point of view)
          createdAt: { $gt: changedSince },
          deleted: { $ne: true },
        },
        {
          // updated record, the client does already know about it
          createdAt: { $lte: changedSince },
        },
      ]
    });
  } else {
    // initially we don't want deleted records
    conditions.push({deleted: {$ne: true}});
  }

  // limit option
  let limit = MAX_RECORD_COUNT; // maximum limit
  if (req.query['limit']) {
    limit = Math.min(limit, parseInt(req.query['limit']));
  }

  // start-token option
  let skip = 0;
  if (req.query['start-token']) {
    skip = parseInt(req.query['start-token']);
  }

  try {
    const queryConditions = { $and: conditions };
    const totalCount = await ChargeEvent.count(queryConditions);
    let changeToken: number|null = null;

    if (!req.query['limit']) {
      const latestRecord = await ChargeEvent.findOne(queryConditions).sort({updatedAt: -1});
      if (latestRecord) {
        changeToken = latestRecord.updatedAt.valueOf();
      }
    }

    const query = ChargeEvent.find(queryConditions)
        .sort({'updatedAt': 1})
        .limit(limit)
        .skip(skip);
    const events = await query;

    const eventsCount = events.length;
    const remaining = totalCount - eventsCount - skip;
    const moreComing = remaining > 0;
    const startToken = moreComing ? skip + eventsCount : null;

    return res.json({
      success: true,
      moreComing: moreComing,
      totalCount: totalCount,
      startToken: startToken,
      changeToken: changeToken,
      events: events
          .map(event => event.toObject({virtuals: true, versionKey: false, minimize: false}))
    });
  } catch (err) {
    next(err);
  }

});

/**
 * fetch latest inserted (own) record
 */
router.get('/events/latest', async (req: AppRequest, res: Response, next: NextFunction) => {
  const conditions: any[] = [];

  setReadACLs(req.clientInfo, conditions);

  conditions.push({source: req.clientInfo.source});

  try {
    const queryConditions = { $and: conditions };
    const query = ChargeEvent.findOne(queryConditions)
        .sort({'upstreamUpdatedAt': -1});
    const latestEvent = await query;
    if (!latestEvent) {
      return next(); // throw a 404 error
    }

    return res.json(latestEvent.toObject({virtuals: true, versionKey: false}));
  } catch (err) {
    next(err);
  }

});

export interface DeleteEventsResponse {
  deletedRecordCount: number,
}

router.delete('/events', async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const conditions: any[] = [];
    setWriteACLs(req.clientInfo, conditions);
    const response = await ChargeEvent.remove({$and: conditions}) as any;
    res.json(<DeleteEventsResponse>{
      deletedRecordCount: response.result.n,
    });
  } catch (err) {
    next(err);
  }
});

// noinspection JSUnusedGlobalSymbols
export interface PostEventsPayload {
  recordsToSave?: any[],
  recordIDsToDelete?: any[],
}

export interface PostEventsResponse {
  savedRecords: any[],
  deletedRecordCount: Number,
}

router.post('/events', async (req: AppRequest, res: Response, next: NextFunction) => {

  try {
    const eventsPayload = req.body as PostEventsPayload;

    let ChargeEventType: Model<any>;
    switch (req.clientInfo.type) {
      case 'CheckIn':
        ChargeEventType = CheckIn;
        break;
      case 'Ladelog':
        ChargeEventType = Ladelog;
        break;
      case 'CKCheckIn':
        ChargeEventType = CKCheckIn;
        break;
      default:
        // noinspection ExceptionCaughtLocallyJS
        throw new Error(`ChargeEvent type: ${req.clientInfo.type} not valid`);
    }

    const writeConditions: any[] = [];
    setWriteACLs(req.clientInfo, writeConditions);

    let savedRecords: any[] = [];
    if (eventsPayload.recordsToSave) {
      const eventsToSave = eventsPayload.recordsToSave.map(eventData => {

        const newChargeEvent = new ChargeEventType(eventData);
        newChargeEvent.source = req.clientInfo.source;
        return newChargeEvent;
      });
      const insertedCheckIns = await ChargeEventType.insertMany(eventsToSave);
      savedRecords = insertedCheckIns.map($0 => $0.toObject());
    }

    let deletedRecordCount = 0;

    if (eventsPayload.recordIDsToDelete) {
      const objectIDsToDelete = eventsPayload.recordIDsToDelete.map($0 => new ObjectID($0));
      writeConditions.push({ _id: { $in: objectIDsToDelete } });
      const response = await ChargeEventType.update(
          { $and: writeConditions },
          {deleted: true, modifiedAt: Date.now()},
          { multi: true }
      );
      deletedRecordCount = response.nModified;
    }

    res.json(<PostEventsResponse>{
      savedRecords: savedRecords,
      deletedRecordCount: deletedRecordCount,
    });

  } catch (err) {
    next(err);
  }

});

// catch 404 and forward to error handler
router.use((req, res, next) => {
  const err = new Error('Not Found') as Error;
  err.status = 404;
  next(err);
});

// catch all
//noinspection JSUnusedLocalSymbols
router.use((err: Error, req: Request, res: Response, next: NextFunction) => {

  if ((<any>err).name === 'ValidationError') {
    err.status = 400;
  }
  res.status(err.status || 500);

  res.json({
    status: res.statusCode,
    success: false,
    message: err.message,
  });
});

export const apiController: Router = router;
