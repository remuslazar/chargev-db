import {sign, verify} from "jsonwebtoken";

export interface APIClientInfo {
  /** A short string identifying the client */
  clientID: string;
  source: number;
  type: string; // which ChargeEvent type to use, e.g. "CheckIn", "Ladelog"
  acl: {
    /** ChargeEvent.source filter. List all allowed sources here */
    sources?: number[];
  };
}

export class JWTAuthService {

  constructor(private secret: string) {
    if (!secret) {
      throw new Error('no JWT secret configured');
    }
  }

  public async generateToken(clientInfo: APIClientInfo, expiresSeconds: number): Promise<string> {
    return await sign(clientInfo, this.secret, {
      expiresIn: expiresSeconds,
    });
  }

  public async verifyAndDecode(token: string) {
    return await verify(token, this.secret) as APIClientInfo;
  }

}
