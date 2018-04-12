# API Admin Doc

The `ChargeEvent` API uses JWT for authentication.

### Create new Auth Tokens

Valid tokens can be created by using the CLI:

```bash
./api-cli.ts --generate --source 10 --type CheckIn --sources 0 --sources 1 --client fooClient 
```

This will generate a new token for a client names `fooClient` and select both sources 0 and 1.

#### Client Own source

The client `source` is being saved in the token, in the above example 
the new client will use the source identifier `10`.

**Important Note: for development, use sources >= 1000.**

#### Client ACLs

When not using the `--sources` parameter, the client will gain access to all available sources.

#### Expiration

Note: generated tokens will expire after 2 months. To overwrite that use the --expires parameter, which will accept a
custom expire time (in seconds).

### Verification

The CLI also allows validation of existing tokens:

```bash
./api-cli.ts --verify --token <token>
```

This will verify the given token and also print out the JWT content (payload).
