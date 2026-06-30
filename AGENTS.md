# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

This is a GitHub Action that automatically uploads build artifacts to a Mosapi CMS asset folder, creates an update record to associate those files with a product, and optionally sends a WeChat Work robot notification. The action is implemented as a composite action using a repository-local Node.js script.

## Key Files

- `action.yaml`: Action definition including inputs, outputs, and execution runner steps.
- `scripts/upload.js`: The main entry point script of the action, containing input parsing, glob matching, upload request with retries, MD5 checksum calculation, update record creation on Mosapi, and optional WeChat notification logic.
- `package.json`: Project package configuration with ESM configuration and dependencies (`@actions/core`, `@actions/glob`).
- `tests/`: Directory containing unit tests for sanity check, input validation, glob parsing, file uploading, update record creation, checksum handling, WeChat notification formatting, and batch coordination.
- `my.secrets` / `my.variables`: Local-only `act` configuration files ignored by git. Create them from the README examples when running integration tests locally; do not commit real credentials.
- `test-resource/dist/`: Sample files for local and workflow integration testing.

## Action Configuration

### Required Inputs
- `token`: Mosapi authorization token (e.g. `${{ secrets.MOSAPI_TOKEN }}`)
- `artifacts`: Glob patterns for files to upload (supports multiline and exclusions starting with `!`)
- `folder-id`: Mosapi CMS asset folder ID (e.g. `190`)
- `product-id`: Mosapi product ID to associate the update with (e.g. `230`)
- `version`: Release version string (e.g. `1.0.2`)
- `product-slug`: Product slug prefix for update record slug generation (e.g. `nearhub-launch-windows`)

### Optional Inputs
- `endpoint`: Mosapi upload endpoint (defaults to `https://mosapi-admin.auditoryworks.co/v1/upload`)
- `if-no-files-found`: Behaviour when no files match: `error` (default), `warn`, or `ignore`
- `retries`: Retry count for file uploads (defaults to `3`)
- `changelog`: Description of the update record. If not provided, it resolves from the workspace's `temp_changelog.txt` if present, or uses a default string
- `state`: Update state (defaults to `alpha`, supports `alpha`, `beta`, `release`)
- `type`: Update type (defaults to `optional`, supports `optional`, `force`)
- `wechat-webhook-key`: Optional WeChat Work robot webhook key. Notification failures are emitted as warnings and do not fail the upload/update flow
- `project-name`: Optional display name used in WeChat notifications (defaults to `product-slug`)

### Outputs
- `uploaded-count`: Number of successfully uploaded files
- `uploaded-files`: JSON array of metadata containing local path, name, asset ID, URL, Mosapi response fields, and calculated `md5`
- `update-id`: ID of the created Mosapi update record
- `update-slug`: Generated slug of the created Mosapi update record

## Architecture

The action executes as a composite action:
1. Installs Node.js dependencies (`npm ci --omit=dev`) inside the action directory.
2. Invokes `node scripts/upload.js`.
3. The script:
   - Validates and parses inputs.
   - Finds matching files via `@actions/glob` while filtering out directories.
   - For each file, uploads it independently to the upload endpoint using native `fetch` with retries.
   - Calculates an MD5 checksum for each uploaded file.
   - Groups the successfully uploaded file IDs and checksums, then sends a POST request to `/v1/updates` to create the update record linked to the `productId`.
   - Fetches the populated details of the newly created update via GET.
   - Emits action outputs and handles failures using `@actions/core`.
   - Sends a WeChat Work notification when `wechat-webhook-key` is provided; notification errors are warnings only.

## Development & Testing Commands

### Running Unit Tests
```bash
npm install
npm test
```

### Local Integration Testing with act
```bash
# Create local-only my.secrets and my.variables first; see README.md.
act --container-architecture linux/amd64 --input trigger=manually --secret-file my.secrets --var-file my.variables -W .github/workflows/test_with_local_actions.yaml
```

## Common Usage Pattern

```yaml
- name: Upload and Update Mosapi CMS
  uses: Mostorm-Labs/mosapi-action@v1.0.0
  with:
    token: ${{ secrets.MOSAPI_TOKEN }}
    folder-id: '190'
    product-id: '230'
    version: ${{ github.ref_name }}
    product-slug: 'nearhub-launch-windows'
    changelog: ${{ github.event.release.body }}
    artifacts: |
      dist/*.exe
      dist/*.zip
      !dist/*.map
```
