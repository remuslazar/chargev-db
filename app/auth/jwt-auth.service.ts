import {sign, verify} from "jsonwebtoken";

export interface APIClientInfo {
  /** A short string identifying the client */
  clientID: string;
  source: number;
  acl: {
    /** ChargeEvent.source filter. List all allowed sources here */
    sources?: number[];
  }
}

export class JWTAuthService {

  constructor(private secret: string) {
    if (!secret) {
      throw new Error('no JWT secret configured');
    }
  }

  async generateToken(clientInfo: APIClientInfo, expiresSeconds: number): Promise<string> {
    return await sign(clientInfo, this.secret, {
      expiresIn: expiresSeconds,
    });
  }

  async verifyAndDecode(token: string) {
    return await verify(token, this.secret) as APIClientInfo;
  }

}
