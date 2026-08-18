# Changesets

Add one non-empty changeset file for each user-visible package change before
publishing a version that has already been released.

The first public release is a deliberate baseline: all four publishable
packages already carry version `0.1.0`, and `changeset publish` will publish
those unpublished local versions without applying a version bump. After the
initial release, every public API or behavior change must include a non-empty
changeset and go through `release:version` before publishing.
