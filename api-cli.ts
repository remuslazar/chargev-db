#!/usr/bin/env ts-node

import * as dotenv from "dotenv";
import {APIClientInfo, JWTAuthService} from "./app/auth/jwt-auth.service";

dotenv.config();
const argv = require('minimist')(process.argv.slice(2));
const manager = new JWTAuthService(<string>process.env.API_JWT_SECRET);

const main = async() => {
  if (argv.generate) {
    if (!argv['client'] || argv['source'] === undefined) {
      throw new Error('parameter mismatch.');
    }

    const source = parseInt(argv.source, 10);

    let sources = argv.sources;
    if (!(sources instanceof Array)) { sources = [sources]; }

    const type = argv['type'];

    const clientInfo = <APIClientInfo>{
      clientID: argv['client'],
      source: source,
      type: type,
      acl: {
        sources: argv.sources !== undefined ? sources : undefined,
      },
    };

    const expires = argv.expires || 2 * 30 * 24 * 3600; // default: expires in 2 months
    const token = await manager.generateToken(clientInfo, expires);
    console.log(token);

  } else if (argv.verify) {
    const token = argv.token;
    if (!token) {
      throw new Error('please supply the token to check using the --token option.');
    }
    const decoded = await manager.verifyAndDecode(token);
    console.log(decoded);
  }
};

main().then(() => {
}, err => {
  console.error(`ERROR: ${err.toLocaleString()}`);
});
