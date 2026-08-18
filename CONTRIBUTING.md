# Contributing

Thanks for helping improve `next-route-kit`.

## Before opening a pull request

1. Explain the user-facing problem and the proposed behavior.
2. Keep Next.js-specific behavior inside the adapter package; keep Core based on
   Web APIs and framework-neutral contracts.
3. Add or update tests for behavior and public type changes.
4. Update the relevant architecture, implementation, or status document.
5. Run the local checks:

    ```bash
    pnpm install
    pnpm typecheck
    pnpm build
    pnpm test
    pnpm lint
    pnpm exec prettier --check .
    ```

Use the issue templates for bugs, feature requests, and Next.js compatibility
reports. Small, focused pull requests are easier to review and release.

## Git hooks

After `pnpm install`, Husky installs the repository's `pre-commit` hook. It
runs `lint-staged`, so only files included in the current commit are checked:

- TypeScript and JavaScript files are formatted with `prettier --write`, then
  validated by ESLint.
- JSON, Markdown, YAML, and similar configuration files are formatted with
  Prettier.

Prettier changes are automatically added back to the same commit. Code checks
run in `pre-commit`; the `commit-msg` hook remains available for a future
commit-message policy and is intentionally not used for source formatting.

## Test layout

Package `src/` directories contain publishable production code only. Tests live
under the corresponding package `tests/` directory so unit tests, integration
tests, and future Next.js compatibility fixtures can grow without mixing test
artifacts into the package entrypoint tree.

## Architecture boundaries

- Do not introduce runtime route scanning, hidden global registries, or a second
  router.
- Do not make Core import Next.js internals.
- Prefer explicit Factory composition and optional plugins.
- Record changes to public API or architecture in `docs/` and an ADR when needed.
