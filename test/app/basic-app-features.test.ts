import {app} from "../../app/server";
import * as chai from 'chai';
import request = require('request-promise');
import {StatusCodeError} from "request-promise/errors";
import {TestAuthService} from "../auth/test-auth.service";

describe('App Basic Features', function() {

  // noinspection TypeScriptValidateJSTypes
  this.slow(1500);
  this.timeout(5000);
  const port = 3999;
  let baseURL: string;

  // make sure to start express on our custom port
  before(done => {
    app.listen(port, () => {
      baseURL = `http://localhost:${port}/`;
      done();
    });
  });

  it(`should start a HTTP server on port ${port}`, () => {
    chai.expect(baseURL).not.undefined;
  });

  it('should respond to HTTP requests', async() => {
    const result = await request.get(baseURL);
    chai.expect(result).contain('chargev-db');
  });

  it('should always return JSON data', async() => {
    const jwt = await (new TestAuthService()).getTestAuthJTW();
    try {
      const headers = {Authorization: 'Bearer ' + jwt};
      await request.get(baseURL + 'api/v1/nonExistingEndpoint', {json: true, headers: headers});
      chai.expect.fail('should not return 200');
    } catch (err) {
      if (err instanceof StatusCodeError) {
        chai.expect(err.statusCode).eql(404);
        const response = err.response as any;
        chai.expect(response.body.success).false;
        return;
      }
      throw err;
    }
  });

  it('should respond with 403 on the API endpoint base URL', async() => {
    try {
      await request.get(baseURL + 'api/v1/', { json: true });
      chai.expect.fail('should not return 200');
    } catch (err) {
      if (err instanceof StatusCodeError) {
        chai.expect(err.statusCode).eql(403);
        const response = err.response as any;
        chai.expect(response.body.success).false;
      } else {
        throw err;
      }
    }
  });

});
