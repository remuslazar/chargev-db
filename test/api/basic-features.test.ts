process.env.API_JWT_SECRET = 'test_secret';

import * as chai from 'chai';
import chaiHttp = require("chai-http");
import {app} from "../../app/server";
import * as mongoose from "mongoose";
import {TestAuthService} from "../auth/test-auth.service";

chai.use(chaiHttp);

let jwt: string;
const testAuthService = new TestAuthService();

after(() => {
  mongoose.disconnect(() => {
    process.exit(0);
  });
});

function getURL(endpoint: string) {
  return `/api/v1/${endpoint}`;
}

describe('API Basic Features', () => {

  describe('JWT Auth', () => {

    const eventsEndpointURL = getURL('events');

    before(async() => {
      jwt = await testAuthService.getTestAuthJTW();
    });

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


});