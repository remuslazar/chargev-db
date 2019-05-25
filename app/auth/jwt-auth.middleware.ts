import {Request, Response, NextFunction} from "express";
import {APIClientInfo, JWTAuthService} from "./jwt-auth.service";
import {app} from "../app";
import {API_JWT_SECRET} from "./auth.constants";

// This middleware will extend the request object
export interface AppRequest extends Request {
  clientInfo: APIClientInfo;
  authError?: string;
}

/**
 * Internal method to extract the JWT from the request headers of URL query param
 *
 * @param {e.Request} req
 * @returns {string | null}
 */
const getTokenfromHeaderOrQuerystring = (req: Request): string|null => {
  const authHeader = req.header('Authorization');

  if (authHeader && authHeader.split(' ')[0] === 'Bearer') {
    return authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    return req.query.token;
  }
  return null;
};

/**
 * Express Middleware to authenticate requests using a JWT
 *
 * If the auth succeeds, the decoded JWT (of type ClientInfo) is available in req.clientInfo
 *
 * @param {AppRequest} req
 * @param {e.Response} res
 * @param {e.NextFunction} next
 * @returns {Promise<Response>}
 */
export const jwtAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authService = new JWTAuthService(app.get(API_JWT_SECRET));

  // check header or url parameters or post parameters for token
  const token = getTokenfromHeaderOrQuerystring(req);
  const appReq = req as AppRequest;

  // decode token
  if (token) {
    try {
      appReq.clientInfo = await authService.verifyAndDecode(token);
      next();
    } catch (err) {
      appReq.authError = `Failed to authenticate token: ${err.toLocaleString()}`;
      return res.status(403).send({ success: false, message: appReq.authError });
    }
  } else {
    // if there is no token, return an error
    appReq.authError = 'No auth token provided';
    return res.status(403).send({
      success: false,
      message: appReq.authError,
    });
  }

};
