# ChargeEvents API

## Abstract

This is a preliminary specification of the `ChargeEvent` REST API.

## Basics, API Endpoints and Auth

Currently the API is publicly available using this endpoint:

https://chargev-db.herokuapp.com/api/v1/

### Auth

Authentication is currently implemented using a JWT (JSON Web Token). During development all issued tokens will expire
after 2 months.

The JWT Token is a string like e.g.

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjbGllbnRJRCI6ImZvb0NsaWVudCIsImFjbCI6eyJzb3VyY2VzIjpbMCwxXX0sImlhdCI6MTUyMjc2NDM2NiwiZXhwIjoxNTI3OTQ4MzY2fQ.jpWlbxuvcNXLpmYsRs1xcVZgbRxja_aozqwxKR8L3hM
```

For authentication purposes, the user agent should send the JWT, typically in the Authorization header using the Bearer
schema. The content of the header should look like the following:

```
Authorization: Bearer <token>
```

For convenience, the token can also be send as a URL query parameter named `token`.

### Endpoints

#### ChargsEvents List

`GET /events`

This endpoint will deliver the list of all events.

Note: there is a configured maximum record count for a single REST call. See the Response description for instructions how to
fetch all records using the `startToken` info.

##### Response

The API Response has the following structure:

```
{
   "success": boolean,
   "totalCount": number,
   "moreComing": boolean,
   "startToken": number | null,
   "changeToken": string,
   "events": ChargeEvent[]
}
```

* `success`: true if the request was successful. If `false`, use the `message` key to obtain a (non localized) error
  message description.
* `totalCount`: The total number of records available
* `moreComing`: if true, the `startToken` value is not `null` and means that there are more records available. Fetch them
  using subsequent API calls and pass the `startToken`.
* `startToken`: Pass this value to the subsequent API call to fetch more records (only available if `moreComing` is
  `true`)
* `changeToken`: For delta downloads, save this token locally and use it next time you want to get updated records
* `events`: Array of `ChargeEvents`. Basically a Sub-Type, see the "Models" section below.

##### Options (URL query params)a

There are some (all optional) query params:

* `limit`: limit the result set (fetch only n newest records)
* `start-token`: if moreComing is true, use the `startToken` value from the last request to fetch more records
* `change-token`: use this for delta downloads to get only changed records
* `limit`: limit the result set
* `changed-since`: fetch only records newer than the given timestamp. The Timestamp can be a ISO formatted date string or
  timestamp (UTC miliseconds after 1.1.70)

#### Default sorting

The records are sorted by the modification timestamp in a descending order. The `limit` option can be used to fetch only
the most recent records.

### Delta Downloads

Delta Downloads are useful to synchronise the local cache. Using the `changeToken` from last request will
give you only updated records since the last time you fetched them.

#### In a nutshell

Initially, when you want to fetch all records and build the local cache for the first time, don't use a changeToken.
After the batch run ends, save the received `changeToken` locally, e.g. filesystem or database.

Next time you want to get only the updated records, to update the local cache, use the saved `changeToken` and use the
`change-token` URL GET param for that. The API will send you all updated records.

Note: while using the `changeToken` you will also receive potentially deleted records. Make sure to check the
appropriate flag and act accordingly, e.g. delete these records from the local cache.

#### Insert and Delete Records

There is a single endpoint for a batch style insert and delete:

`POST /events`

##### Payload

```typescript
export interface PostEventsPayload {
  recordsToSave?: CheckIn[],
  recordIDsToDelete?: string[],
}
```

##### Response

```typescript
export interface PostEventsResponse {
  savedRecords: any[],
  deletedRecordCount: Number,
}
```

The save operation will do a validation check and throw a 400 error if this fails. Else an array of
all saved records will be returned and also the count of records deleted.

## Models

### ChargeEvent

A `ChargeEvent` is a base type for all charge related events:

```typescript
export interface ChargeEventBase {
  deleted: boolean;
  source: number;
  timestamp: Date;
  chargepoint: string; // e.g. chargepoint-0-3358
  location: GeoJSON;
  comment?: string;
  nickname?: string;
  userID?: string;
}
```

#### `deleted`

When set to `true`, make sure to delete (or mark as deleted) the record from the backend.

Note: deleted records are filtered out by default and only available by using the delta download feature.

#### `source`

The source field identifies the origin of the record. A unique identifier will be assigned for each pairing peer.
For example, the [chargEV](http://ev-freaks.com/chargev/) App uses the identifier `0`, "Ladelogs" from
[GoingElectric](https://www.goingelectric.de/stromtankstellen/) `1` and so on.

The own `source` identifier is stored in the [JWT Auth Token](#Auth) and can be easily discovered by inspecting the
token.

#### `timestamp`

This is the timestamp associated with the event. Please note that this timestamp is different than the record
modification timestamps, e.g. `modifiedAt` or `createdAt`. Usually the user can adjust this timestamp while creating a new event using the GUI, for
example using a date picker.

This info is meant to be shown in the events list view and should also be used to sort the events chronologically.

#### `chargepoint`

The `chargepoint` field will reference the associated `ChargePoint`. The structure is:

`chargepoint-<registryID>-<chargepointID>`

Currently there are two registries configures:

| Registry | registryID |
| -------- | ---------- |
| GoingElectric (GE) |  0|
| Open Charge Map (OCM) | 1 |

The second part, `chargepointID` is the identifier of the chargepoint in context of the specific registry.

##### Example:

A `chargepoint` identifier like `chargepoint-0-20312` means the GoingElectric ChargePoint with the ID 20312.

#### `location`

The current location of the chargepoint, basically copied 1:1 from the chargepoint as the
event has been created. The Structure here is:

```typescript
// see https://en.wikipedia.org/wiki/GeoJSON
export interface GeoJSON {
  type: string;
  coordinates: number[];
}
```

See https://en.wikipedia.org/wiki/GeoJSON for details.

#### `comment`

This is the comment entered by the user. This is optional, can be empty. This text is a plain UTF-8 coded string and
must not contain HTML entities like e.g. `&uuml;` or HTML tags like `<br>`. Convert them to plain UTF-8 entities if
appropriate.

#### `nickname`

User nickname, if available

#### `userID`

A stable identifier for the user, if available.

## Derived types

Using inheritance there are currently two specialized types which extend the base type and add other infos. E.g. 
the `CheckIn` type which is being used with the `CloudKit` backend will add some `CloudKit` related infos like e.g.
CloudKit User Identifier and other stuff. On the other hand, the `Ladelog` type does have other data related to the
GoingElectric data structure.

### CheckIn Type

```typescript
export interface CheckIn extends ChargeEventBase {
  reason: number;
  plug: string;
}
```

#### Fields

##### `reason`

The `reason` code is a code which classifies the `ChargeEvent`, e.g. if the event was a successful charge event or failure.
Current mapping is:

```swift
        enum Reason: Int {
            case ok = 10
            case recovery = 11

            // failed
            case equipementProblem = 100, equipementProblemNew
            case notCompatible, notCompatibleNew
            case noChargingEquipement, noChargingEquipementNew

            // other
            case notFound = 200
            case dupplicate
            case positive
            case negative
        }
```

##### `plug`


Used plug type (if selected, can be `null`):

```swift
public enum EVChargePoingConnectionPlugType: String {
    case type1 = "Type1"
    case type2 = "Type2"
    case CHAdeMO = "CHAdeMO"
    case CCS = "CCS"
    case CEEBlau = "CEEBlau"
    case CEERot = "CEERot"
    case schuko = "Schuko"
    case teslaSupercharger = "TeslaSupercharger"
    case unknown
}
```

### Ladelog Type

"Ladelog" event from GoingElectric

```typescript
export interface Ladelog extends ChargeEventBase {
  modified: Date;
  isFault: boolean;
}
```

Because the MongoDB Backend uses Mongoose inheritance model, it is using the default discriminator field named `__t`
to specify which type is being used for a particular record.

## Examples

Using curl. Make sure you setup the JWT in the `$token` ENV var, e.g. using:

```bash
export token=<my token>
```

#### Request

```bash
$ curl -qs -H "Authorization: Bearer $token" https://chargev-db.herokuapp.com/api/v1/events/?limit=3 | json_pp
```

#### Response

```json
{
   "totalCount" : 400,
   "moreComing" : true,
   "success" : true,
   "startToken" : 3,
   "events" : [
      {
         "source" : null,
         "location" : {
            "coordinates" : [
               52.548534,
               13.412196
            ],
            "type" : "Point"
         },
         "chargepoint" : "chargepoint-0-23830",
         "reason" : 10,
         "plug" : "Type2",
         "timestamp" : "2018-04-03T15:01:47.757Z",
         "__t" : "CKCheckIn",
         "id" : "5ac397898fd342c660008973",
         "comment" : "This is a test from the simulator",
         "userID" : "_189e255e4e1e1dedaf293a9f8839d84e",
         "nickname" : "Developer"
      },
      {
         "id" : "5ac381c20acbe2e563c88351",
         "timestamp" : "2016-11-16T23:00:00.000Z",
         "__t" : "Ladelog",
         "comment" : "Typ 2 Ladeabbruch nach 1 min",
         "isFault" : true,
         "chargepoint" : "chargepoint-0-9304",
         "source" : 1,
         "location" : {
            "type" : "Point",
            "coordinates" : [
               48.100922,
               11.52887
            ]
         },
      },
      {
         "chargepoint" : "chargepoint-0-7656",
         "location" : {
            "type" : "Point",
            "coordinates" : [
               48.182262,
               11.531637
            ]
         },
         "source" : 1,
         "comment" : "22kW auf Parkdeck P1 ist defekt.",
         "isFault" : true,
         "id" : "5ac381c20acbe2e563c88352",
         "__t" : "Ladelog",
         "timestamp" : "2018-02-09T23:00:00.000Z"
      }
   ]
}
```

#### Create and Delete

##### Payload

```json
{
  "recordsToSave": [
    {
      "timestamp": "2018-04-11T10:00:00",
      "chargepoint": "chargepoint-0-7656",
      "location": {
        "type": "Point",
        "coordinates": [
          48,
          11
        ]
      },
      "reason": 10,
      "nickname": "Foo",
      "userID": "BarID"
    },
    {
      "timestamp": "2018-04-11T10:00:00",
      "chargepoint": "chargepoint-0-7656",
      "location": {
        "type": "Point",
        "coordinates": [
          48,
          11
        ]
      },
      "reason": 10,
      "nickname": "Foo",
      "userID": "BarID",
      "plug": "CHAdeMO"
    }
  ],
  "recordIDsToDelete": [
    "5acdf9eb1a8ea9a8eedbbd72",
    "5acdf92e470ebaa8c94a7c5a"
  ]
}
```

##### curl call

```bash
curl -qs -H "Authorization: Bearer $token" -XPOST -H"Content-type: Application/json" -d@post-payload.json http://localhost:3000/api/v1/events | json_pp
```

##### Response

```json
{
   "savedRecords" : [
      {
         "user" : null,
         "__v" : 0,
         "__t" : "CheckIn",
         "id" : "5acdfcb71a8ea9a8eedbbd87",
         "reason" : 10,
         "updatedAt" : "2018-04-11T12:16:55.146Z",
         "source" : 10,
         "nickname" : "Foo",
         "_id" : "5acdfcb71a8ea9a8eedbbd87",
         "createdAt" : "2018-04-11T12:16:55.146Z",
         "timestamp" : "2018-04-11T08:00:00.000Z",
         "location" : {
            "coordinates" : [
               48,
               11
            ],
            "type" : "Point"
         },
         "chargepoint" : "chargepoint-0-7656",
         "userID" : "BarID"
      },
      {
         "__v" : 0,
         "plug" : "CHAdeMO",
         "user" : null,
         "__t" : "CheckIn",
         "id" : "5acdfcb71a8ea9a8eedbbd88",
         "reason" : 10,
         "createdAt" : "2018-04-11T12:16:55.146Z",
         "_id" : "5acdfcb71a8ea9a8eedbbd88",
         "source" : 10,
         "nickname" : "Foo",
         "updatedAt" : "2018-04-11T12:16:55.146Z",
         "timestamp" : "2018-04-11T08:00:00.000Z",
         "location" : {
            "coordinates" : [
               48,
               11
            ],
            "type" : "Point"
         },
         "chargepoint" : "chargepoint-0-7656",
         "userID" : "BarID"
      }
   ],
   "deletedRecordCount" : 2
}

```
## References

1. [JWT - JSON Web Token Introduction](https://jwt.io/introduction/)
2. [Tutorial: Authenticate a Node.js API with JSON Web Tokens](https://scotch.io/tutorials/authenticate-a-node-js-api-with-json-web-tokens)
3. [Mongoose schema inheritance mechanism](http://mongoosejs.com/docs/discriminators.html)
