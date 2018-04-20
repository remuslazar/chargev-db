import {APIClientInfo, JWTAuthService} from "../../app/auth/jwt-auth.service";

export class TestAuthService {
  private service: JWTAuthService;

  constructor() {
    this.service = new JWTAuthService(<string>process.env.API_JWT_SECRET);
  }

  public clientInfo: APIClientInfo = {
    clientID: 'testClient',
    source: 9999,
    type: 'CheckIn',
    acl: {},
  };

  async getTestAuthJTW(): Promise<string> {
    return await this.service.generateToken(this.clientInfo, 900);
  }

  async getExpiredAuthJTW(): Promise<string> {
    return await this.service.generateToken(this.clientInfo, -1);
  }

}