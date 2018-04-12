import {Router} from 'express';
import {ChargeEvent} from "../models/chargeevent.model";

const router: Router = Router();

router.get('/', async (req, res, next) => {
  try {
    // const conditions = {source: {$ne: 1}}; // CKCheckInSource.goingElectricSync
    // const conditions = { 'deleted': { $ne: true } };
    const conditions = {};
    const count = await ChargeEvent.count(conditions);
    const events = await ChargeEvent
        .find(conditions, {}, {limit: 100, sort: {'timestamp': -1}})
        .populate('user', 'nickname recordName');
    res.render('chargeevents', {
      count: count,
      events: events,
    })
  } catch(err) {
    next(err);
  }
});

export const chargeeventsController: Router = router;
