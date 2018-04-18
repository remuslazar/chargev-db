# chargEV DB Sync Details

## ChargeEvent Timestamps

With each `ChargeEvent` record there are 3 timestamps associated:

* `timestamp`
* `updatedAt`
* `upstreamUpdatedAt`

### `timestamp`

This timestamp is the timestamp when the event occurred, editable by user. This info should be shown in the frontend,
e.g. in the list view of `ChargeEvent`s.

### `updatedAt`

This timestamp is the timestamp when the particular record was last modified in the `chargEV DB` database. This info
is used for synchronization usind a delta-download approach: the client saved the last known timestamp and fetches
only newer records using this parameter. The API will provide the newest timestamp in the `changeToken` (see API specification
for details).

### `upstreamUpdatedAt`

This timestamp is the timestamp when the particular record was last modified in the _upstream_ `client Backend`. Basically
this is the timestamp when the record was modified by the user (on save).

To perform a delta-upload process records which are newer than this timestamp. The API provides an endpoint
to fetch the _latest record_ using this timestamp.

This info is also sometimes useful to be shown in frontend to visualize when the charge event was last modified by user.
