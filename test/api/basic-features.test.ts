process.env.API_JWT_SECRET = 'test_secret';

import * as chai from 'chai';
import chaiHttp = require("chai-http");
import {app} from "../../app/server";
import * as mongoose from "mongoose";
import {TestAuthService} from "../auth/test-auth.service";


chai.use(chaiHttp);

let jwt: string;
const testAuthService = new TestAuthService();

before(async() => {
  jwt = await testAuthService.getTestAuthJTW();
});

after(() => {
  mongoose.disconnect(() => {
    process.exit(0);
  });
});

describe('API Basic Features', () => {

  it('should return 403 if not authorized', async() => {
    const res = await chai.request(app).get('/api/v1/events');
    chai.expect(res.status).eq(403);
  });

  it('should authenticate using a JWT', async() => {
    const request = chai.request(app);
    const res = await request
        .get('/api/v1/events')
        .set('Authorization', 'Bearer ' + jwt);
    chai.expect(res.status).eq(200);
  });

});