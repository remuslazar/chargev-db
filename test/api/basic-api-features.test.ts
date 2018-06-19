import {GetEventsResponse, PostEventsPayload, PostEventsResponse} from "../../app/controllers/api.controller";

process.env.API_JWT_SECRET = 'test_secret';

// append the -test suffix to the MONGODB_URI env var, if needed
if (process.env.MONGODB_URI && !(<string>process.env.MONGODB_URI).match(/-test$/)) {
  process.env.MONGODB_URI += '-test';
}

import * as chai from 'chai';
import chaiHttp = require("chai-http");
import {TestAuthService} from "../auth/test-auth.service";
import {ChargeEvent, ChargeEventBase, ICheckIn} from "../../app/models/chargeevent.model";
import {app} from "../../app/app";

chai.use(chaiHttp);

const testAuthService = new TestAuthService();

function getURL(endpoint: string) {
  return `/api/v1/${endpoint}`;
}

describe('API Basic Features', async() => {

  let jwt: string;

  before(async() => {
    jwt = await testAuthService.getTestAuthJTW();
  });

  const insertChargeEvent = async (source?: number): Promise<ChargeEventBase> => {
    const singleEvent = new ChargeEvent();
    singleEvent.source = source !== undefined ? source : testAuthService.clientInfo.source;
    singleEvent.chargepoint = 'chargepoint-0-1234';
    singleEvent.timestamp = new Date();
    singleEvent.upstreamUpdatedAt = new Date();
    return await singleEvent.save();
  };

  const insertManyChargeEvents = async (count: number, source?: number): Promise<ChargeEventBase[]> => {
    const eventsToInsert: ChargeEventBase[] = [];
    for(let i=0; i<count; i++) {
      const singleEvent = new ChargeEvent();
      singleEvent.source = source !== undefined ? source : testAuthService.clientInfo.source;
      singleEvent.chargepoint = 'chargepoint-0-1234';
      singleEvent.timestamp = new Date();
      singleEvent.upstreamUpdatedAt = new Date();
      eventsToInsert.push(singleEvent);
    }
    return await ChargeEvent.insertMany(eventsToInsert);
  };

  beforeEach(async () => {
    await ChargeEvent.remove({});
  });

  describe('JWT Auth', () => {

    const eventsEndpointURL = getURL('events');

    it('should return 403 if not authorized', async() => {
      const res = await chai.request(app).get(eventsEndpointURL);
      chai.expect(res.status).eq(403);
    });

    const authenticatedRequest = (token: string) => {
      return chai.request(app)
          .get(eventsEndpointURL)
          .set('Authorization', 'Bearer ' + token);
    };

    it('should authenticate using a JWT', async() => {
      const res = await authenticatedRequest(jwt);
      chai.expect(res.status).eq(200);
      chai.expect(res.body.success).true;
    });

    it('should not authenticate using a bogus string', async() => {
      const res = await authenticatedRequest('foo');
      chai.expect(res.status).eq(403);
      chai.expect(res.body.success).false;
      chai.expect(res.body.message).contains('Failed');
      chai.expect(res.body.message).contains('malformed');
    });

    it('should not authenticate using an expired token', async() => {
      const expiredToken = await testAuthService.getExpiredAuthJTW();
      const res = await authenticatedRequest(expiredToken);
      chai.expect(res.status).eq(403);
      chai.expect(res.body.success).false;
      chai.expect(res.body.message).contains('Failed');
      chai.expect(res.body.message).contains('expired');
    });

  });

  describe('API CRUD Methods', () => {

    describe('GET /events', () => {

      it('should return an empty result set', async() => {
        const response = await chai.request(app).get(getURL('events')).set('Authorization', 'Bearer ' + jwt);

        chai.expect(response.status).eq(200);
        const getEventsResponse = response.body as GetEventsResponse;

        chai.expect(getEventsResponse.moreComing).false;
        chai.expect(getEventsResponse.totalCount).eql(0, 'totalCount should be zero initially');
      });

      it('should return a single event', async() => {

        const insertedEvent = await insertChargeEvent();
        const response = await chai.request(app).get(getURL('events')).set('Authorization', 'Bearer ' + jwt);

        chai.expect(response.status).eq(200);
        const getEventsResponse = response.body as GetEventsResponse;

        chai.expect(getEventsResponse.moreComing).false;
        chai.expect(getEventsResponse.totalCount).eql(1);
        const event = getEventsResponse.events[0] as ChargeEventBase;
        chai.expect(event.chargepoint).eql(insertedEvent.chargepoint);
      });

      it('should return multiple events', async() => {

        await insertChargeEvent();
        await insertChargeEvent();
        await insertChargeEvent();

        const response = await chai.request(app).get(getURL('events')).set('Authorization', 'Bearer ' + jwt);

        chai.expect(response.status).eq(200);
        const getEventsResponse = response.body as GetEventsResponse;

        chai.expect(getEventsResponse.moreComing).false;
        chai.expect(getEventsResponse.totalCount).eql(3);
      });

    });

    describe('GET /events/latest', () => {
      it('should fetch last inserted record', async () => {

        const firstInserted = await insertChargeEvent();
        await insertChargeEvent();
        const lastInserted = await insertChargeEvent();

        const response = await chai.request(app).get(getURL('events/latest')).set('Authorization', 'Bearer ' + jwt);
        chai.expect(response.status).eq(200);

        const returnedEvent = response.body as ChargeEventBase;

        chai.expect(new Date(returnedEvent.upstreamUpdatedAt)).not.eql(firstInserted.upstreamUpdatedAt);
        chai.expect(new Date(returnedEvent.upstreamUpdatedAt)).eql(lastInserted.upstreamUpdatedAt);

      });

    });

    describe('POST /events', () => {
      it('should insert records', async () => {

        const recordToInsert = <ICheckIn>{
          timestamp: new Date(),
          comment: 'foo comment',
          chargepoint: 'chargepoint-0-1234',
          reason: 10,
        };

        const postEventsPayload = <PostEventsPayload>{
          recordsToSave: [ recordToInsert],
        };

        const response = await chai.request(app)
            .post(getURL('events'))
            .set('Authorization', 'Bearer ' + jwt)
            .send(postEventsPayload);

        chai.expect(response.status).eq(200);

        const returnedEvent = response.body as PostEventsResponse;

        chai.expect(returnedEvent.savedRecords.length).eql(1);
        const insertedRecord = returnedEvent.savedRecords[0] as ICheckIn;
        chai.expect(insertedRecord.chargepoint).eql(recordToInsert.chargepoint);
      });

      it('should not insert invalid records', async () => {

        const recordToInsert = <any>{
          timestamp: new Date(),
          comment: 'foo comment',
          chargepoint: 'chargepoint-0-1234',
          reason: 10 + 'foo',
        };

        const postEventsPayload = <PostEventsPayload>{
          recordsToSave: [ recordToInsert],
        };

        const response = await chai.request(app)
            .post(getURL('events'))
            .set('Authorization', 'Bearer ' + jwt)
            .send(postEventsPayload);

        chai.expect(response.status).eq(400);
      });

      it('should insert record with plug=null', async () => {

        const recordToInsert = <ICheckIn>{
          timestamp: new Date(),
          comment: 'foo comment',
          chargepoint: 'chargepoint-0-1234',
          reason: 10,
          plug: null,
        };

        const postEventsPayload = <PostEventsPayload>{
          recordsToSave: [ recordToInsert],
        };

        const response = await chai.request(app)
            .post(getURL('events'))
            .set('Authorization', 'Bearer ' + jwt)
            .send(postEventsPayload);

        chai.expect(response.status).eq(200);

        const returnedEvent = response.body as PostEventsResponse;

        chai.expect(returnedEvent.savedRecords.length).eql(1);
        const insertedRecord = returnedEvent.savedRecords[0] as ICheckIn;
        chai.expect(insertedRecord.chargepoint).eql(recordToInsert.chargepoint);
      });
    });

    describe('DELETE /events', () => {
      it('should delete own records', async () => {
        await insertChargeEvent();
        await insertChargeEvent(1000);
        const response = await chai.request(app).del(getURL('events')).set('Authorization', 'Bearer ' + jwt);
        chai.expect(response.status).eq(200);
        const count = await ChargeEvent.find({}).count();
        chai.expect(count).eql(1);
      });
    });

  });

  describe('API Additional Features', () => {

    describe('GET /events startToken Feature', () => {

      it('should fetch all available records in batches', async function () {

        // noinspection TypeScriptValidateJSTypes
        this.slow(1200);
        this.timeout(10000);

        await insertManyChargeEvents(1000);

        const response = await chai.request(app).get(getURL('events')).set('Authorization', 'Bearer ' + jwt);
        chai.expect(response.status).eq(200);

        let apiResponse = response.body as GetEventsResponse;
        chai.expect(apiResponse.moreComing).true;
        chai.expect(apiResponse.totalCount).eql(1000);

        let totalCount = apiResponse.events.length;

        while (apiResponse.moreComing) {
          const response = await chai.request(app)
              .get(getURL('events'))
              .set('Authorization', 'Bearer ' + jwt)
              .query({'start-token': apiResponse.startToken});
          chai.expect(response.status).eq(200);
          apiResponse = response.body as GetEventsResponse;
          totalCount += apiResponse.events.length;
        }

        chai.expect(totalCount).eql(1000);
      });
    });

    describe('GET /events Delta Download Feature', () => {
      it('should fetch only new records using a change token', async () => {
        await insertManyChargeEvents(2);

        let response = await chai.request(app).get(getURL('events')).set('Authorization', 'Bearer ' + jwt);
        chai.expect(response.status).eq(200);

        const firstAPIResponse = response.body as GetEventsResponse;
        chai.expect(firstAPIResponse.moreComing).false;
        chai.expect(firstAPIResponse.totalCount).eql(2);
        chai.expect(firstAPIResponse.changeToken).exist;

        response = await chai.request(app)
            .get(getURL('events'))
            .set('Authorization', 'Bearer ' + jwt)
            .query({'change-token': firstAPIResponse.changeToken});
        chai.expect(response.status).eq(200);
        const secondAPIResponse = response.body as GetEventsResponse;

        chai.expect(secondAPIResponse.events.length).eql(0, 'expected no new records using the change-token');

        // we insert 3 more records
        await insertManyChargeEvents(3);

        // send a subsequent request using the last change-token
        // we expect to get only the 3 new records
        response = await chai.request(app)
            .get(getURL('events'))
            .set('Authorization', 'Bearer ' + jwt)
            .query({'change-token': firstAPIResponse.changeToken});
        chai.expect(response.status).eq(200);
        const thirdAPIResponse = response.body as GetEventsResponse;

        chai.expect(thirdAPIResponse.totalCount).eql(3, 'expected 3 new records using a change-token');
        chai.expect(thirdAPIResponse.events.length).eql(3, 'expected 3 new records using a change-token');

      });
    });

    describe('GET /events limit Parameter', () => {

      it('should limit the fetched result set', async function () {

        await insertManyChargeEvents(13);

        const response = await chai.request(app)
            .get(getURL('events'))
            .set('Authorization', 'Bearer ' + jwt)
            .query({limit: 10});

        chai.expect(response.status).eq(200);

        const apiResponse = response.body as GetEventsResponse;
        chai.expect(apiResponse.moreComing).true;
        chai.expect(apiResponse.totalCount).eql(13, 'total count should be 13');
        chai.expect(apiResponse.events.length).eql(10, 'returned events count should be 10');

      });
    });

    describe('GET /events changed-since Parameter', () => {

      it('should fetch only newer records', async function() {

        const timeout = (ms: number) => new Promise(res => setTimeout(res, ms));

        const insertedEvents: ChargeEventBase[] = [];
        for(let i=0;i<20;i++) {
          insertedEvents.push(await insertChargeEvent());
          await timeout(1);
        }

        const timestampOfTheThirdRecord = insertedEvents[2].updatedAt;

        const response = await chai.request(app)
            .get(getURL('events'))
            .set('Authorization', 'Bearer ' + jwt)
            .query({'changed-since': timestampOfTheThirdRecord});

        chai.expect(response.status).eq(200);

        const apiResponse = response.body as GetEventsResponse;
        chai.expect(apiResponse.events.length).eql(insertedEvents.length-3, 'the logic should skip the first 3 records');

      });

      it('should work with numeric timestamp values', async function () {

        const response = await chai.request(app)
            .get(getURL('events'))
            .set('Authorization', 'Bearer ' + jwt)
            .query({'changed-since': (new Date()).getTime()});

        chai.expect(response.status).eq(200);

      });

    });

  });

});
