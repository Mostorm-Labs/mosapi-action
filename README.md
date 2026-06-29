# mosapi-action

This GitHub Action allows you to automatically upload build artifacts to a Mosapi CMS asset folder and create an update record to associate those files with a product.

## Usage

```yaml
steps:
- name: Checkout code
  uses: actions/checkout@v3

- name: Upload artifacts to Mosapi CMS
  uses: Mostorm-Labs/mosapi-action@v1
  with:
    token: ${{ secrets.MOSAPI_TOKEN }}
    folder-id: '190'
    product-id: '230'
    version: '1.0.2'
    artifacts: |
      dist/*.exe
      dist/*.zip
      !dist/*.map
```

## Inputs

| Name | Required | Default | Description |
| --- | --- | --- | --- |
| `token` | yes | | Mosapi authorization token |
| `artifacts` | yes | | Glob patterns for files to upload. Supports multiline patterns and `!` exclusions |
| `folder-id` | yes | | Mosapi CMS asset folder ID (e.g. `190`) |
| `product-id` | yes | | Mosapi product ID to associate the update with (e.g. `230`) |
| `version` | yes | | Release version string (e.g. `1.0.2`) |
| `endpoint` | no | `https://mosapi-admin.auditoryworks.co/v1/upload` | Mosapi upload endpoint |
| `if-no-files-found` | no | `error` | Action when no files match: `error`, `warn`, or `ignore` |
| `retries` | no | `3` | Upload retry count per file |
| `changelog` | no | | Changelog description for the update record. If empty, reads from `temp_changelog.txt` or uses default |
| `state` | no | `alpha` | Update state (`alpha`, `beta`, `release`) |
| `type` | no | `optional` | Update type (`optional`, `force`) |
| `product-slug` | yes | | Product slug prefix for the update name |

## Outputs

| Name | Description |
| --- | --- |
| `uploaded-count` | Number of files uploaded successfully |
| `uploaded-files` | JSON array containing local file metadata and Mosapi response fields |
| `update-id` | ID of the created Mosapi update record |
| `update-slug` | Slug of the created Mosapi update record |

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
   Create a `my.secrets` file containing:
   ```text
   MOSAPI_TOKEN=your-actual-token
   ```

   Create a `my.variables` file containing:
   ```text
   MOSAPI_FOLDER_ID=190
   MOSAPI_PRODUCT_ID=230
   ```

4. **Run local test**:
   ```bash
   act --container-architecture linux/amd64 --input trigger=manually --secret-file my.secrets --var-file my.variables -W .github/workflows/test_with_local_actions.yaml
   ```

## License
This GitHub Action is licensed under the MIT License.
