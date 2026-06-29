# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

This is a GitHub Action that automatically uploads build artifacts to a Mosapi CMS asset folder and creates an update record to associate those files with a product. The action is implemented as a composite action using a repository-local Node.js script.

## Key Files

- `action.yaml`: Action definition including inputs, outputs, and execution runner steps.
- `scripts/upload.js`: The main entry point script of the action, containing input parsing, glob matching, upload request with retries, and update record creation on Mosapi.
- `package.json`: Project package configuration with ESM configuration and dependencies (`@actions/core`, `@actions/glob`).
- `tests/`: Directory containing unit tests for sanity check, input validation, glob parsing, file uploading, update record creation, and batch coordination.
- `my.secrets`: Template file for configuring local credentials.
- `my.variables`: Template file for configuring local environment variables.
- `test-resource/sample.html`: Sample HTML file for local integration testing.

## Action Configuration

### Required Inputs
- `token`: Mosapi authorization token (e.g. `${{ secrets.MOSAPI_TOKEN }}`)
- `artifacts`: Glob patterns for files to upload (supports multiline and exclusions starting with `!`)
- `folder-id`: Mosapi CMS asset folder ID (e.g. `190`)
- `product-id`: Mosapi product ID to associate the update with (e.g. `230`)
- `version`: Release version string (e.g. `1.0.2`)

### Optional Inputs
- `endpoint`: Mosapi upload endpoint (defaults to `https://mosapi-admin.auditoryworks.co/v1/upload`)
- `if-no-files-found`: Behaviour when no files match: `error` (default), `warn`, or `ignore`
- `retries`: Retry count for file uploads (defaults to `3`)
- `changelog`: Description of the update record. If not provided, it resolves from the workspace's `temp_changelog.txt` if present, or uses a default string
- `state`: Update state (defaults to `alpha`, supports `alpha`, `beta`, `release`)
- `type`: Update type (defaults to `optional`, supports `optional`, `force`)
- `product-slug`: Product slug prefix for slug name generation (defaults to `nearhub-launch-windows`)

### Outputs
- `uploaded-count`: Number of successfully uploaded files
- `uploaded-files`: JSON array of metadata containing local path, name, asset ID, and URL
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
   - Groups the successfully uploaded file IDs and sends a POST request to `/v1/updates` to create the update record linked to the `productId`.
   - Fetches the populated details of the newly created update via GET.
   - Emits action outputs and handles failures using `@actions/core`.

## Development & Testing Commands

### Running Unit Tests
```bash
npm install
npm test
```

### Local Integration Testing with act
```bash
# Start Docker and run act locally:
act --container-architecture linux/amd64 --input trigger=manually --secret-file my.secrets --var-file my.variables -W .github/workflows/test_with_local_actions.yaml
```

## Common Usage Pattern

```yaml
- name: Upload and Update Mosapi CMS
  uses: Mostorm-Labs/mosapi-action@v1
  with:
    token: ${{ secrets.MOSAPI_TOKEN }}
    folder-id: '190'
    product-id: '230'
    version: ${{ github.ref_name }}
    changelog: ${{ github.event.release.body }}
    artifacts: |
      dist/*.exe
      dist/*.zip
      !dist/*.map
```