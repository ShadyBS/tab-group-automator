# Project Scripts

This directory contains all utility, validation, build, and packaging scripts used in the CI/CD pipeline for the browser extension project.

## Structure

- `validation/`: Lint, manifest, permissions, security, CSP, and performance checks.
- `build/`: Build scripts for Chromium and Firefox.
- `utils/`: Changelog, vendor integrity, summary, docs, and legacy cleanup.
- `package/`: Packaging scripts for distribution.

## CI/CD Workflow

### Continuous Integration (CI)

- Trigger: Every push or pull request to `main`/`master`.
- Steps: Lint, validate, build, package, generate changelog, summary, documentation, and upload artifacts.
- Workflow file: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml:1)

### Continuous Delivery (CD) — GitHub Release

- Trigger: Push of a tag matching `v*` (e.g., `v1.2.3`).
- Steps:
  1. Checkout, install, lint, validate, build, package, changelog, summary, docs.
  2. Cria um release no GitHub usando a tag.
  3. Anexa os artefatos gerados (`chromium.zip`, `firefox.zip`, `build-summary.md`, `scripts-README.md`) ao release.
  4. Release notes são extraídas do `CHANGELOG.md`.
- Workflow file: [`.github/workflows/cd.yml`](../../.github/workflows/cd.yml:1)

## Usage

Each script is self-documented and can be run via `node` or through npm scripts defined in `package.json`.

See [`scripts/utils/README.md`](scripts/utils/README.md:1) for a summary of all scripts and their descriptions.
