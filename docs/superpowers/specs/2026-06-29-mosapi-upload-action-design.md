# Mosapi Upload Action Design

## Goal

Build a Windows-friendly GitHub Action that uploads build artifacts to a Mosapi CMS asset folder.

The first version is intentionally limited to file upload. It does not create Mosapi update records, attach OTA files to content types, generate changelogs, or send WeChat notifications.

## Context

The current repository is copied from an Aliyun CLI composite action template. Its existing `action.yaml` installs and configures Aliyun CLI, which will be replaced by a Mosapi upload action.

The reference implementation lives in `/Users/was/Desktop/Lichenghuan/code/electron-launcher/shell/upload-assets`. Its useful upload behavior is:

- POST files to `https://mosapi-admin.auditoryworks.co/v1/upload`.
- Send `Authorization` with `MOSAPI_TOKEN`.
- Use multipart form data with a `files` field and a `fileInfo` JSON field.
- Include `{ "name": fileName, "folder": folderId }` in `fileInfo`.

The reference script currently hardcodes folder `190` and also creates update records and notifications. This action should make folder id configurable and exclude those release-specific behaviors.

## Recommended Approach

Use a Node-based composite action.

`action.yaml` will invoke a repository-local Node script, such as `scripts/upload.js`. The script will handle input validation, glob matching, file upload, retry behavior, and GitHub Action outputs.

This keeps the action close to the existing composite template while avoiding Bash and PowerShell portability problems on `windows-latest`.

## Action Interface

Inputs:

| Name | Required | Default | Description |
| --- | --- | --- | --- |
| `token` | yes | | Mosapi authorization token, normally `${{ secrets.MOSAPI_TOKEN }}` |
| `artifacts` | yes | | Glob patterns for files to upload. Supports multiline patterns and `!` exclusions |
| `folder-id` | yes | | Mosapi CMS asset folder id |
| `endpoint` | no | `https://mosapi-admin.auditoryworks.co/v1/upload` | Mosapi upload endpoint |
| `if-no-files-found` | no | `error` | One of `error`, `warn`, or `ignore` |
| `retries` | no | `3` | Upload retry count per file |

Outputs:

| Name | Description |
| --- | --- |
| `uploaded-count` | Number of files uploaded successfully |
| `uploaded-files` | JSON array containing local file metadata and Mosapi response fields |

Example usage:

```yaml
- name: Upload assets to Mosapi
  uses: Lichenghuan/mosapi-action@v1
  with:
    token: ${{ secrets.MOSAPI_TOKEN }}
    folder-id: ${{ vars.MOSAPI_FOLDER_ID }}
    artifacts: |
      dist/*
      !dist/*.map
```

## Script Behavior

The upload script reads action inputs from environment variables populated by the composite action:

- `INPUT_TOKEN`
- `INPUT_ARTIFACTS`
- `INPUT_FOLDER_ID`
- `INPUT_ENDPOINT`
- `INPUT_IF_NO_FILES_FOUND`
- `INPUT_RETRIES`

The script then:

1. Validates required inputs.
2. Parses `artifacts` as newline-aware glob patterns.
3. Ignores empty lines.
4. Supports exclusion patterns beginning with `!`.
5. Deduplicates matches.
6. Filters out directories so only files are uploaded.
7. Uploads each file with multipart form data.
8. Retries failed uploads per file.
9. Writes `uploaded-count` and `uploaded-files` outputs.

Use `@actions/core` for input, output, warning, and failure handling. Use `@actions/glob` for GitHub Actions-compatible glob semantics, including multiline patterns and exclusions.

## Upload Request

Each matched file is uploaded independently:

- Method: `POST`
- URL: `endpoint`
- Headers:
  - `Authorization: <token>`
- Form fields:
  - `files`: file contents with the local basename
  - `fileInfo`: JSON string with `name` and `folder`

Example `fileInfo`:

```json
{
  "name": "app.exe",
  "folder": "190"
}
```

The action treats a 2xx response as success. The expected Mosapi response is an array, and the first item represents the uploaded file. The output object should preserve useful response fields such as `id`, `url`, and `name` when present, and should also include the local `path` and `name`.

## Error Handling

Missing `token`, `artifacts`, or `folder-id` fails the action immediately.

When no files match:

- `error`: fail the action.
- `warn`: emit a warning and output `uploaded-count=0`.
- `ignore`: succeed without warning and output `uploaded-count=0`.

When Mosapi returns a non-2xx response, the error includes the HTTP status and a short response body excerpt. The token must never be printed.

Each file has independent retry behavior. If all retry attempts fail for any file, the action fails.

## Logging

Logs should be concise and secret-safe:

```text
Found 3 file(s) to upload.
Uploading dist/app.exe...
Uploaded dist/app.exe -> id=123
Uploaded 3 file(s) successfully.
```

Do not log the `Authorization` value.

## Testing

Add focused tests for:

- Required input validation.
- Glob matching, multiline patterns, exclusions, and directory filtering.
- `if-no-files-found` behavior.
- Upload request construction.
- Use of `folder-id` in `fileInfo.folder`.
- Retry behavior.
- Output shape.

Upload tests should mock `fetch` rather than call real Mosapi.

Add or update workflow examples for `windows-latest`. Template CI should avoid real Mosapi uploads unless the workflow is manually triggered with secrets configured.

## Out Of Scope

This design does not include:

- Creating Mosapi `/v1/updates` records.
- Associating uploaded files with OTA content entries.
- Changelog generation.
- WeChat notification.
- Linux/macOS as primary compatibility targets.
- New Mosapi API discovery or schema changes.
