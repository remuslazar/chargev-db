# chargEV DB

## Intended Purpose

`chargeEV DB` is a kind-of _aggregation_ database for EV "ChargeEvents". A ChargeEvent is an event related to an EV charging
activity, e.g. it can be an acknowledgment for a successful charge or a failure report.

_Aggregation_ means that this DB/API is not meant to be used directly from the enduser client (e.g. web- or native app).

The intended usecase is that the clients will use an own backend to primarily store the data (e.g. CloudKit, Firebase, ..).
Then, periodically, using a server-to-server approach the client's backend can synchronize its data with `chargEV DB`
bidirectionally. For that purpose this API provides a batch interface and delta-download and -upload features using
change tokens.

## Open Source

The whole codebase of `chargEV DB` and also the `CloudKit` Adapter used by the `chargEV App` are both available for free under the
MIT license (see the `LICENSE` file for details).

## TOC

* [API Specification](API)
* [API Legal Usage](API-legal-usage-DE) (German)

## Author

Remus Lazar [remus@ev-freaks.com](mailto:remus@ev-freaks.com)

## References

* [GitHub Repository for the chargEV Codebase](https://github.com/remuslazar/chargev-db)
* [EV-Freaks Website](http://ev-freaks.com)
* [chargEV iOS App](http://ev-freaks.com/chargev)
