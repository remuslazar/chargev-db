import * as express from 'express';
import * as path from 'path';
import logger = require('morgan');
import * as dotenv from 'dotenv';
import bodyParser = require('body-parser');
import {Request, Response, NextFunction} from 'express';
import * as mongoose from 'mongoose';
import * as basicAuth from 'express-basic-auth'
import {API_JWT_SECRET} from "./auth/auth.constants";
import {rootController} from './controllers/root.controller';
import {apiController} from "./controllers/api.controller";
import {chargeeventsController} from "./controllers/chargeevents.controller";
import {AppRequest} from "./auth/jwt-auth.middleware";

export const app: express.Application = express();

dotenv.config();

app.set(API_JWT_SECRET, process.env[API_JWT_SECRET]);

let basicAuthUsers = {} as any;
const username: string = process.env['BASIC_AUTH_USERNAME'] || 'username';
basicAuthUsers[username] = process.env['BASIC_AUTH_PASSWORD'];

const auth = basicAuth({
  users: basicAuthUsers,
  challenge: true,
  realm: 'ge-tools',
});

const port: number = parseFloat(process.env.PORT || '') || 3000;

app.set('views', path.join(__dirname, '../../app/views'));
app.use(express.static(path.join(__dirname, '../../app/public')));

// we want to log the clientID of the JWT auth token or auth failures
logger.token('jwtAuthInfo', (req: AppRequest) => {
  return req.clientInfo ? `[API clientID: ${req.clientInfo.clientID}]`
      : req.authError ? `[API auth error: ${req.authError}]` : '';
});

// don't log the static stuff
app.use(logger(':method :url :status :response-time ms - :res[content-length] :jwtAuthInfo'));

app.set('view engine', 'jade');
app.set('trust proxy', 'loopback, linklocal, uniquelocal');

app.use(bodyParser.json());
app.use('/api/v1', apiController);

app.use('/events', auth, chargeeventsController);
app.use('/', auth, rootController);

const packageInfo = require('../../package.json');
app.locals.packageInfo = packageInfo;
app.locals.moment = require('moment');

export interface Error {
    status?: number;
    message?: string;
}

export const notFoundError = new Error('Not Found') as Error;
notFoundError.status = 404;

// catch 404 and forward to error handler
app.use((req, res, next) => {
  const err = new Error('Not Found') as Error;
  err.status = 404;
  next(err);
});

// error handler
// noinspection JSUnusedLocalSymbols
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = err;

  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

(mongoose as any).Promise = global.Promise;

/**
 * Connect to MongoDB.
 */
// mongoose.Promise = global.Promise;
mongoose.connect(process.env.MONGODB_URI || 'mongodb://mongodb', {
  useMongoClient: true,
});

mongoose.connection.on("error", () => {
  console.log("MongoDB connection error. Please make sure MongoDB is running.");
  process.exit();
});

app.listen(port, () => {
  // Success callback
  console.log(`Listening at http://localhost:${port}/`);
});
