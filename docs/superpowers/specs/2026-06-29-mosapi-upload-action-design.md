# Mosapi Upload Action Design

> Status: Historical design document updated to match the current `v1.0.0` action behavior. The source of truth is the implementation in `action.yaml`, `scripts/upload.js`, and tests.

## Goal

Build a Windows-friendly GitHub Action that uploads build artifacts to a Mosapi CMS asset folder, creates a Mosapi update record associated with a product, and optionally sends a WeChat Work robot notification.

## Context

The repository started from an Aliyun CLI composite action template and was converted into a Mosapi upload/update action.

The upload behavior is based on the Mosapi upload API:

- POST files to `https://mosapi-admin.auditoryworks.co/v1/upload` by default.
- Send `Authorization` with `MOSAPI_TOKEN`.
- Use multipart form data with a `files` field and a `fileInfo` JSON field.
- Include `{ "name": fileName, "folder": folderId }` in `fileInfo`.

The action now also creates a Mosapi `/v1/updates` record after successful uploads. Each uploaded file is attached to `otaFiles` with the file ID and calculated MD5 checksum.

## Recommended Approach

Use a Node-based composite action.

`action.yaml` invokes the repository-local `scripts/upload.js` script. The script handles input validation, glob matching, file upload, retry behavior, update record creation, optional notification, and GitHub Action outputs.

This keeps the action close to the original composite action shape while avoiding Bash and PowerShell portability problems on `windows-latest`.

## Action Interface

Inputs:

| Name | Required | Default | Description |
| --- | --- | --- | --- |
| `token` | yes | | Mosapi authorization token, normally `${{ secrets.MOSAPI_TOKEN }}` |
| `artifacts` | yes | | Glob patterns for files to upload. Supports multiline patterns and `!` exclusions |
| `folder-id` | yes | | Mosapi CMS asset folder id |
| `product-id` | yes | | Mosapi product ID to associate the update with |
| `version` | yes | | Release version string |
| `product-slug` | yes | | Product slug prefix for update record slug generation |
| `endpoint` | no | `https://mosapi-admin.auditoryworks.co/v1/upload` | Mosapi upload endpoint |
| `if-no-files-found` | no | `error` | One of `error`, `warn`, or `ignore` |
| `retries` | no | `3` | Upload retry count per file |
| `changelog` | no | | Changelog description for the update record. If empty, reads from `temp_changelog.txt` or uses a default |
| `state` | no | `alpha` | Update state: `alpha`, `beta`, or `release` |
| `type` | no | `optional` | Update type: `optional` or `force` |
| `wechat-webhook-key` | no | | Optional WeChat Work robot webhook key |
| `project-name` | no | `product-slug` | Optional display name used in WeChat notifications |

Outputs:

| Name | Description |
| --- | --- |
| `uploaded-count` | Number of files uploaded successfully |
| `uploaded-files` | JSON array containing local file metadata, Mosapi response fields, and calculated `md5` checksums |
| `update-id` | ID of the created Mosapi update record |
| `update-slug` | Slug of the created Mosapi update record |

Example usage:

```yaml
- name: Upload assets to Mosapi
  uses: Mostorm-Labs/mosapi-action@v1.0.0
  with:
    token: ${{ secrets.MOSAPI_TOKEN }}
    folder-id: ${{ vars.MOSAPI_FOLDER_ID }}
    product-id: ${{ vars.MOSAPI_PRODUCT_ID }}
    version: ${{ github.ref_name }}
    product-slug: nearhub-launch-windows
    changelog: ${{ github.event.release.body }}
    artifacts: |
      dist/*
      !dist/*.map
```

## Script Behavior

The upload script reads action inputs from environment variables populated by the composite action:

- `INPUT_TOKEN`
- `INPUT_ARTIFACTS`
- `INPUT_FOLDER_ID`
- `INPUT_PRODUCT_ID`
- `INPUT_VERSION`
- `INPUT_PRODUCT_SLUG`
- `INPUT_ENDPOINT`
- `INPUT_IF_NO_FILES_FOUND`
- `INPUT_RETRIES`
- `INPUT_CHANGELOG`
- `INPUT_STATE`
- `INPUT_TYPE`
- `INPUT_WECHAT_WEBHOOK_KEY`
- `INPUT_PROJECT_NAME`

The script then:

1. Validates required inputs.
2. Parses `artifacts` using `@actions/glob`, including multiline patterns and exclusions.
3. Filters out directories so only files are uploaded.
4. Uploads each file with multipart form data.
5. Retries failed uploads per file.
6. Calculates each file's MD5 checksum.
7. Creates a Mosapi `/v1/updates` record connected to `product-id` and populated with `otaFiles` entries.
8. Fetches the created update record with populated `otaFiles`.
9. Writes `uploaded-count`, `uploaded-files`, `update-id`, and `update-slug` outputs.
10. Sends a WeChat Work notification when configured.

Use `@actions/core` for output, warning, info, and failure handling. Use `@actions/glob` for GitHub Actions-compatible glob semantics.

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

The action treats a 2xx response as success. The expected Mosapi response is an array, and the first item represents the uploaded file. The output object preserves useful response fields such as `id`, `url`, and `name` when present, and also includes the local `path`, local basename, and calculated `md5`.

## Update Record Request

After all files upload successfully, the action derives the updates endpoint from the upload endpoint:

- `https://mosapi-admin.auditoryworks.co/v1/upload` -> `https://mosapi-admin.auditoryworks.co/v1/updates`

It sends a POST body with:

- generated `slug`: `${productSlug}-${version}__${ISODate}`
- `version`
- `date`
- `state`
- `type`
- connected `products`
- English and Chinese `descriptions`
- `otaFiles`, including each uploaded file ID and MD5 checksum
- empty `imgFiles` and `extFiles`

The action then GETs the created record with `populate[otaFiles][populate]=*` and emits `update-id` and `update-slug`.

## WeChat Work Notification

When `wechat-webhook-key` is provided, the action sends a markdown message to the WeChat Work robot webhook. The message includes:

- project name
- version
- uploaded file links
- Mosapi admin URL for the update record
- changelog

Notification failure emits an action warning and does not fail the successful upload/update flow.

## Error Handling

Missing `token`, `artifacts`, `folder-id`, `product-id`, `version`, or `product-slug` fails the action immediately.

When no files match:

- `error`: fail the action.
- `warn`: emit a warning and output `uploaded-count=0`.
- `ignore`: succeed without warning and output `uploaded-count=0`.

When Mosapi returns a non-2xx response, the error includes the HTTP status and a short response body excerpt. The token must never be printed.

Each file has independent retry behavior. If all retry attempts fail for any file, the action fails before creating the update record.

## Logging

Logs should be concise and secret-safe:

```text
Found 3 file(s) to upload.
Uploading dist/app.exe...
Uploaded dist/app.exe -> id=123
Calculated MD5 for dist/app.exe -> <checksum>
Uploaded 3 file(s) successfully.
Creating update record on Mosapi...
Created update record successfully. ID: 456, Slug: nearhub-launch-windows-1.0.2__...
```

Do not log the `Authorization` value or webhook key.

## Testing

Focused tests cover:

- Required input validation.
- Glob matching, multiline patterns, exclusions, and directory filtering.
- `if-no-files-found` behavior.
- Upload request construction.
- Use of `folder-id` in `fileInfo.folder`.
- Retry behavior.
- MD5 checksum generation.
- Update record creation and populated fetch.
- WeChat Work notification formatting.
- Output shape.

Upload and notification tests mock `fetch` rather than calling real Mosapi or WeChat Work.

## Out Of Scope

This design does not include:

- Discovering or changing the Mosapi API schema.
- Retrying update record creation independently from uploads.
- Persisting local secret templates in git.
- Treating WeChat notification failure as a release blocker.
