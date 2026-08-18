# Release checklist

This checklist is the gate for publishing packages from `main`. The first
public release is `0.1.0`; later releases must use Changesets to calculate the
next versions.

## One-time repository setup

- [ ] Create or confirm ownership of the npm `@next-route-kit` scope.
- [ ] Confirm `next-route-kit` and all scoped package names are available.
- [ ] Create an npm automation token with publish access and required 2FA
      policy.
- [ ] Add the token as the GitHub `NPM_TOKEN` secret.
- [ ] Create the protected GitHub Environment named `npm-release` and require
      maintainer approval.
- [ ] Confirm the repository Actions workflow has permission to create release
      tags.

## Before the first 0.1.0 release

Run from a clean checkout of the intended `main` commit:

```bash
pnpm install --frozen-lockfile
pnpm release:check
pnpm release:status
```

`release:check` runs lint, typecheck, all tests, production builds, packed
external-consumer verification, Next.js 15/16 Turbopack smoke tests, and the
formatting check. `release:status` confirms that Changesets has no unaccounted
package changes. The initial empty marker is intentionally not a version bump;
the package manifests already carry `0.1.0`.

## npm package boundary

Each public package declares an explicit `files` allowlist. Its npm tarball is
limited to:

- `package.json` (added by npm);
- `dist/` runtime JavaScript and TypeScript declarations;
- `README.md`;
- `CHANGELOG.md`;
- `LICENSE`.

Source files, tests, fixtures, workspace configuration, Changesets, and
maintainer documentation stay in GitHub and are not shipped to npm.
`pnpm verify:packed` inspects the actual tarball before installing it in an
external consumer.

Then:

- [ ] Commit all release code and documentation.
- [ ] Push the commit to `main`.
- [ ] Wait for every required CI job to pass.
- [ ] Confirm `package.json` versions are still `0.1.0`.
- [ ] Dispatch the `Release` workflow with `confirm=true`.
- [ ] Approve the `npm-release` environment.

The workflow runs the same release gate, publishes the four packages through
Changesets, creates package tags, and pushes those tags to the repository. It
does not run automatically on every push and does not bypass `main` branch
protection by pushing source commits.

## Subsequent releases

For every user-visible package change:

```bash
pnpm changeset
pnpm release:version
pnpm install --lockfile-only
pnpm release:check
```

Review the generated package `CHANGELOG.md` files and version changes, commit
them on `main`, push, wait for CI, and dispatch the protected Release workflow.
Do not change package versions manually after `release:version`.

## Post-publish verification

- [ ] Check each package version with `npm view`.
- [ ] Install `next-route-kit` and `@next-route-kit/zod` in a clean temporary
      Next.js app.
- [ ] Run a Node Route Handler and an Edge Route Handler from the published
      packages.
- [ ] Run a validation failure and confirm the expected 400 response.
- [ ] Confirm the Git tags exist on the repository.
- [ ] Record the npm versions and CI run URL in the project status log.

## Failure and rollback policy

Never overwrite a published version or remove a package as a normal rollback.
If a release is faulty, stop the workflow, document the affected versions, and
publish a corrective patch after reproducing the failure in the packed consumer
and compatibility fixtures. Security incidents follow `SECURITY.md`.
