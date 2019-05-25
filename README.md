# chargEV DB [![Build Status](https://travis-ci.org/ev-freaks/chargev-db.svg?branch=master)](https://travis-ci.org/ev-freaks/chargev-db)

## Abstract

This repository holds the codebase and tools (like a simple web-frontend to visualize latest records)
for the chargEV DB. This database has a public (Server-to-Server) API which is implemented using
this codebase.

See the documentation the [docs](docs) folder for technical details of the API and the current API specification.

## Development

### Setup

Start the MongoDB in Docker:

```bash
npm install
docker-compose up -d db
export MONGODB_URI=mongodb://$(docker-machine ip default)/chargevdb
```

#### Setup .env

Create a `.env` file for development:

```
API_JWT_SECRET=secret
```

### Start the FE

```bash
npm run tsc ; npm start
```

## Heroku

This App is currently deployed on Heroku:

https://dashboard.heroku.com/apps/chargev-db

### ENV vars

For production set the same env vars listen in the `.env` file using e.g. `heroku config:add`.

### Get the current MongoDB Dump

Get the current connect Link from mLab (see "installed add-ons" in the Overview section).

The current mongoDB User and Pass are stored in the `MONGODB_URI` config var (See "Settings" section), als the full
URI can be used.

```bash
docker-compose exec db mongoexport --quiet --uri $(heroku config:get MONGODB_URI) -c chargeevents > chargeevents.jsonl
```

### Import a MongoDB Dump

```bash
docker-compose exec -T db mongoimport -d chargevdb --drop -c chargeevents < chargeevents.jsonl 
```

## License

See the [LICENSE](LICENSE) file.

## Author

Remus Lazar <remus@lazar.info>
