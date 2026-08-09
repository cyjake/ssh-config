# Releasing

Release Please maintains a release pull request from conventional commits merged
to `master`. Merging that pull request synchronizes `package.json` and
`deno.json`, updates `History.md`, creates the `vX.Y.Z` GitHub release, verifies
the tagged source, and publishes to npm and JSR with OIDC.

The npm trusted publisher must authorize `.github/workflows/npmpublish.yml`.
JSR must remain linked to `cyjake/ssh-config`.

For CI to run automatically on Release Please pull requests, configure a
fine-grained token as the `RELEASE_PLEASE_TOKEN` repository secret. It needs
read/write access to contents and pull requests. Without it, Release Please
falls back to `GITHUB_TOKEN`; releases still work, but GitHub suppresses
workflow events caused by that token.

Before merging a release pull request, confirm that Node CI and Deno CI pass.
If one registry publish fails after the other succeeds, rerun only the failed
publish job; registry versions are immutable.
