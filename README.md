# chargEV DB

## Abstract

This repository holds the code and tools for the chargEV "ChargeEvents" Database.
This database has a public (Server-to-Server) API.

## Development

### Setup

Start the MongoDB in Docker:

```bash
npm install
docker-compose start db
export MONGODB_URI=mongodb://$(docker-machine ip default)/chargevdb
```

#### Setup .env

Create a `.env` file:

```
GE_API_KEY=<here your GE API Key>
BASIC_AUTH_USERNAME=<basic auth username>
BASIC_AUTH_PASSWORD=<basic auth password (plaintext)>
CLOUDKIT_KEY_ID=<here your cloudkit key>
CLOUDKIT_CONTAINER=iCloud.info.lazar.EVPlugFinder
CLOUDKIT_ENV=development
API_JWT_SECRET=<here JWT secret>
```

## Start the FE

```bash
npm start
```

## Heroku

This App is currently deployed on Heroku:

https://dashboard.heroku.com/apps/chargev-db

### CloudKit PEM Key

Make sure you create a config var for the PEM file:

```bash
heroku config:add CLOUDKIT_PRIVATE_KEY_FILE="$(cat eckey.pem)"
```

Then use the supplied targets in `package.json` to create the key file on the local filesystem:

```bash
npm run create-cloudkit-key
```

### Get the current MongoDB Dump

Get the current connect Link from mLab (see "installed add-ons" in the Overview section).

The current mongoDB User and Pass are stored in the `MONGODB_URI` config var (See "Settings" section), als the full
URI can be used.

```bash
mongoexport --uri "<MongoDB URI from Heroku>" -c chargeevents > chargeevents.jsonl 
```

### Import a MongoDB Dump

```bash
mongoimport --uri $MONGODB_URI --drop -c chargeevents chargeevents.jsonl 
```