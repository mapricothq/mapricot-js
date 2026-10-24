# Releasing

1. Bump the version in `package.json` and `jsr.json`, following [semantic versioning](https://semver.org/), and merge it to `main`.
2. Publish a GitHub release whose tag is that version with a `v`, such as `v0.2.0`: `gh release create v0.2.0 --generate-notes`.
3. The release workflow runs the live tests, then publishes to npm with provenance and to JSR.

## Keeping up with the API

CI runs every Monday as well as on each push. Its `endpoints` job fails when [the API's OpenAPI description](https://api.mapricot.com/openapi.json) lists an endpoint this client has no method for, and its tests fail when a live response changes. Add or fix the method and its test, and release a new minor version. A new endpoint is added to every Mapricot SDK at the same time.

## One-time setup

- A repository secret or organization secret `MAPRICOT_KEY`: a server key with the `places`, `routing`, and `ip-geolocation` scopes and a monthly cap, used by the live tests.
- A `release` environment in this repository.
- On npmjs.com, the `mapricot` package with this repository's `release.yml` workflow and `release` environment as its trusted publisher. npm needs the package to exist first, so publish 0.1.0 once by hand with `npm publish --access public`.
- On jsr.io, the `@mapricot` scope with the `mapricot` package linked to this repository.
