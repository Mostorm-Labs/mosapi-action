# mosapi-action

This GitHub Action uploads build artifacts to a Mosapi CMS asset folder, creates a Mosapi update record for a product, and can optionally send a WeChat Work robot notification.

## Usage

Use a pinned release tag such as `v1.0.0`. If this repository later maintains a floating major tag, `v1` can also be used.

```yaml
steps:
- name: Checkout code
  uses: actions/checkout@v3

- name: Upload artifacts to Mosapi CMS
  id: mosapi_upload
  uses: Mostorm-Labs/mosapi-action@v1.0.1
  with:
    token: ${{ secrets.MOSAPI_TOKEN }}
    folder-id: '190'
    product-id: '230'
    version: '1.0.2'
    product-slug: 'nearhub-launch-windows'
    changelog: ${{ github.event.release.body }}
    artifacts: |
      dist/*.exe
      dist/*.zip
      !dist/*.map

- name: Use uploaded files
  run: |
    echo "Uploaded count: ${{ steps.mosapi_upload.outputs.uploaded-count }}"
    echo "Files JSON: ${{ steps.mosapi_upload.outputs.uploaded-files }}"
    echo "Update ID: ${{ steps.mosapi_upload.outputs.update-id }}"
```

## Inputs

| Name | Required | Default | Description |
| --- | --- | --- | --- |
| `token` | yes | | Mosapi authorization token |
| `artifacts` | yes | | Glob patterns for files to upload. Supports multiline patterns and `!` exclusions |
| `folder-id` | yes | | Mosapi CMS asset folder ID (e.g. `190`) |
| `product-id` | yes | | Mosapi product ID to associate the update with (e.g. `230`) |
| `version` | yes | | Release version string (e.g. `1.0.2`) |
| `product-slug` | yes | | Product slug prefix for the update record slug |
| `endpoint` | no | `https://mosapi-admin.auditoryworks.co/v1/upload` | Mosapi upload endpoint |
| `if-no-files-found` | no | `error` | Action when no files match: `error`, `warn`, or `ignore` |
| `retries` | no | `3` | Upload retry count per file |
| `changelog` | no | | Changelog description for the update record. If empty, reads from `temp_changelog.txt` or uses default |
| `state` | no | `alpha` | Update state (`alpha`, `beta`, `release`) |
| `type` | no | `optional` | Update type (`optional`, `force`) |
| `wechat-webhook-key` | no | | Optional WeChat Work robot webhook key. Notification failures are emitted as warnings and do not fail the upload/update flow |
| `project-name` | no | | Optional display name used in WeChat notifications. Defaults to `product-slug` |

## Outputs

| Name | Description |
| --- | --- |
| `uploaded-count` | Number of files uploaded successfully |
| `uploaded-files` | JSON array containing uploaded file metadata (`name`, `path`, `id`, `url`, `md5`). The `url` field is resolved to an absolute URL accessible directly |
| `update-id` | ID of the created Mosapi update record |
| `update-slug` | Slug of the created Mosapi update record |

## Behavior

1. Resolves `artifacts` using GitHub Actions-compatible glob semantics and filters out directories.
2. Uploads each matched file independently to the Mosapi upload endpoint with `files` and `fileInfo` multipart fields.
3. Calculates an MD5 checksum for each uploaded file.
4. Creates a `/v1/updates` record connected to `product-id`, with uploaded files written to `otaFiles` as `{ type, file: { id }, md5 }`.
5. Emits upload and update outputs.
6. Sends a WeChat Work notification when `wechat-webhook-key` is provided.

## Environment Setup & Local Testing

### Local Testing with act

1. **Install act**:
   ```bash
   brew install act
   ```

2. **Pull Docker image**:
   ```bash
   docker pull catthehacker/ubuntu:act-latest --platform linux/amd64
   ```

3. **Configure local secrets**:
   Create a local-only `my.secrets` file containing:
   ```text
   MOSAPI_TOKEN=your-actual-token
   # Optional, only needed when testing WeChat Work notifications:
   WECOM_ROBOTS_KEY=your-wechat-work-robot-key
   ```

   Create a local-only `my.variables` file containing:
   ```text
   MOSAPI_FOLDER_ID=190
   MOSAPI_PRODUCT_ID=230
   ```

   Both files are ignored by git and should not be committed.

4. **Run local test**:
   ```bash
   act --container-architecture linux/amd64 --input trigger=manually --secret-file my.secrets --var-file my.variables -W .github/workflows/test_with_local_actions.yaml
   ```

## License
This GitHub Action is licensed under the MIT License.
