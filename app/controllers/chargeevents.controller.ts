import {Router} from 'express';
import {ChargeEvent} from "../models/chargeevent.model";
import * as moment from "moment";

const router: Router = Router();

router.get('/', async (req, res, next) => {
  try {
    // const conditions = {source: {$ne: 1}}; // CKCheckInSource.goingElectricSync
    // const conditions = { 'deleted': { $ne: true } };

    const sort = <any>{};
    if (req.query['sort']) {
      const fieldName = <string>req.query['sort'];
      sort[fieldName] = -1;
    } else {
      sort.timestamp = -1;
    }

    let limit: number = req.query['limit'] ? +req.query['limit'] : 0;

    const conditions = {};
    let newerThan: Date|null = null;

    if (req.query['newer-than']) {
      newerThan = moment.utc(req.query['newer-than']).toDate();
      if (newerThan) {
        conditions['timestamp'] = {$gt: newerThan};
      }
    } else {
      if (limit === 0) {
        limit = 100;
      }
    }

    const count = await ChargeEvent.count(conditions);
    const events = await ChargeEvent
        .find(conditions)
        .limit(limit)
        .sort(sort);
    res.render('chargeevents', {
      count: count,
      limit: limit,
      newerThan: newerThan,
      events: events,
    });
  } catch(err) {
    next(err);
  }
});

router.get('/:chargepointRef', async (req, res, next) => {
  try {
    const chargepointRef = req.params.chargepointRef;
    const conditions = {
      chargepoint: chargepointRef,
    };

    const sort = <any>{};
    if (req.query['sort']) {
      const fieldName = <string>req.query['sort'];
      sort[fieldName] = -1;
    } else {
      sort.timestamp = -1;
    }

    const count = await ChargeEvent.count(conditions);
    const events = await ChargeEvent
        .find(conditions)
        .sort(sort);

    res.render('chargepoint-events', {
      chargepointRef: chargepointRef,
      count: count,
      events: events,
    });
  } catch(err) {
    next(err);
  }
});

export const chargeeventsController: Router = router;
