import {GetEventsResponse, PostEventsPayload, PostEventsResponse} from "../../app/controllers/api.controller";

process.env.API_JWT_SECRET = 'test_secret';

// append the -test suffix to the MONGODB_URI env var, if needed
if (process.env.MONGODB_URI && !(<string>process.env.MONGODB_URI).match(/-test$/)) {
  process.env.MONGODB_URI += '-test';
}

import * as chai from 'chai';
import chaiHttp = require("chai-http");
import {app} from "../../app/server";
import * as mongoose from "mongoose";
import {TestAuthService} from "../auth/test-auth.service";
import {ChargeEvent, ChargeEventBase, ICheckIn} from "../../app/models/chargeevent.model";

chai.use(chaiHttp);

const testAuthService = new TestAuthService();

function getURL(endpoint: string) {
  return `/api/v1/${endpoint}`;
}

describe('API Basic Features', async() => {

  let jwt: string;

  after(async() => {
    await mongoose.connection.close();
    await mongoose.disconnect(async() => {});
  });

  before(async() => {
    jwt = await testAuthService.getTestAuthJTW();
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

    const insertChargeEvent = async (source?: number): Promise<ChargeEventBase> => {
      const singleEvent = new ChargeEvent();
      singleEvent.source = source !== undefined ? source : testAuthService.clientInfo.source;
      singleEvent.chargepoint = 'chargepoint-0-1234';
      singleEvent.timestamp = new Date();
      singleEvent.upstreamUpdatedAt = new Date();
      return await singleEvent.save();
    };

    beforeEach(async () => {
      await ChargeEvent.remove({});
    });

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


});