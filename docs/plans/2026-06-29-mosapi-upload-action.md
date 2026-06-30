# Mosapi Upload Action Implementation Plan

> **Historical note:** This is the original task-by-task implementation plan. It is not the current source of truth for the action interface; use `action.yaml`, `scripts/upload.js`, tests, and `README.md` for current behavior. Known drift has been annotated below.
>
> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Windows-friendly GitHub Action that uploads build artifacts to a Mosapi CMS asset folder and creates an update record.

**Architecture:** A Node-based composite action that executes a repository-local script (`scripts/upload.js`). The script resolves files using `@actions/glob`, uploads them using native `fetch` to Mosapi's `/v1/upload` endpoint, and then creates an update record at `/v1/updates` linking the uploaded files and the configured `productId`.

**Tech Stack:** Node.js (v20), ESM, `@actions/core`, `@actions/glob`, Native Node test runner (`node:test`).

---

### Task 1: Node.js Project Setup & Sanity Test

**Files:**
- Create: `package.json`
- Modify: `.gitignore`
- Test: `tests/setup.test.js`

**Step 1: Write the failing test**
Create `tests/setup.test.js` with a failing assertion:
```javascript
import test from 'node:test';
import assert from 'node:assert';

test('sanity check', () => {
  assert.strictEqual(1, 2);
});
```

**Step 2: Run test to verify it fails**
Run: `npm test`
Expected: Test fails with `AssertionError`.

**Step 3: Write minimal implementation**
Create `package.json`:
```json
{
  "name": "mosapi-action",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "test": "node --test"
  },
  "dependencies": {
    "@actions/core": "^1.10.1",
    "@actions/glob": "^0.4.0"
  }
}
```
Modify `.gitignore` to add `node_modules/`:
```text
node_modules/
```
Modify `tests/setup.test.js` to make the assertion pass:
```javascript
import test from 'node:test';
import assert from 'node:assert';

test('sanity check', () => {
  assert.strictEqual(1, 1);
});
```

**Step 4: Run test to verify it passes**
Run: `npm install && npm test`
Expected: Test suite passes.

**Step 5: Commit**
```bash
git add package.json .gitignore tests/setup.test.js
git commit -m "chore: initialize project and test setup"
```

---

### Task 2: Input Parsing and Validation

**Files:**
- Create: `scripts/upload.js`
- Test: `tests/validation.test.js`

**Step 1: Write the failing test**
Create `tests/validation.test.js` to test input validation for both upload and update inputs:
```javascript
import test from 'node:test';
import assert from 'node:assert';
import { run } from '../scripts/upload.js';

test('throws if token is missing', async () => {
  await assert.rejects(
    run({}),
    /Input required and not supplied: token/
  );
});

test('throws if artifacts is missing', async () => {
  await assert.rejects(
    run({ INPUT_TOKEN: 'test-token' }),
    /Input required and not supplied: artifacts/
  );
});

test('throws if folder-id is missing', async () => {
  await assert.rejects(
    run({ INPUT_TOKEN: 'test-token', INPUT_ARTIFACTS: '*' }),
    /Input required and not supplied: folder-id/
  );
});

test('throws if product-id is missing', async () => {
  await assert.rejects(
    run({ INPUT_TOKEN: 'test-token', INPUT_ARTIFACTS: '*', INPUT_FOLDER_ID: '190' }),
    /Input required and not supplied: product-id/
  );
});

test('throws if version is missing', async () => {
  await assert.rejects(
    run({ INPUT_TOKEN: 'test-token', INPUT_ARTIFACTS: '*', INPUT_FOLDER_ID: '190', INPUT_PRODUCT_ID: '230' }),
    /Input required and not supplied: version/
  );
});
```

**Step 2: Run test to verify it fails**
Run: `node --test tests/validation.test.js`
Expected: Fail (module not found or error mismatch).

**Step 3: Write minimal implementation**
Create `scripts/upload.js` that implements the run function and validates inputs:
```javascript
import fs from 'fs';
import path from 'path';

export async function run(env = process.env) {
  const token = env.INPUT_TOKEN;
  const artifacts = env.INPUT_ARTIFACTS;
  const folderId = env.INPUT_FOLDER_ID;
  const productId = env.INPUT_PRODUCT_ID;
  const version = env.INPUT_VERSION;

  if (!token) throw new Error('Input required and not supplied: token');
  if (!artifacts) throw new Error('Input required and not supplied: artifacts');
  if (!folderId) throw new Error('Input required and not supplied: folder-id');
  if (!productId) throw new Error('Input required and not supplied: product-id');
  if (!version) throw new Error('Input required and not supplied: version');

  const endpoint = env.INPUT_ENDPOINT || 'https://mosapi-admin.auditoryworks.co/v1/upload';
  const ifNoFilesFound = env.INPUT_IF_NO_FILES_FOUND || 'error';
  const retries = parseInt(env.INPUT_RETRIES || '3', 10);

  // Changelog resolution rules:
  // 1. INPUT_CHANGELOG
  // 2. Read temp_changelog.txt if exists
  // 3. Default text
  let changelog = env.INPUT_CHANGELOG;
  if (!changelog) {
    const tempPath = path.resolve(process.cwd(), 'temp_changelog.txt');
    if (fs.existsSync(tempPath)) {
      changelog = fs.readFileSync(tempPath, 'utf-8');
    } else {
      changelog = 'New release with several bug fixes and improvements.';
    }
  }

  const state = env.INPUT_STATE || 'alpha';
  const type = env.INPUT_TYPE || 'optional';
  const productSlug = env.INPUT_PRODUCT_SLUG || 'nearhub-launch-windows';

  return { token, artifacts, folderId, productId, version, endpoint, ifNoFilesFound, retries, changelog, state, type, productSlug };
}
```

**Step 4: Run test to verify it passes**
Run: `node --test tests/validation.test.js`
Expected: Pass.

**Step 5: Commit**
```bash
git add scripts/upload.js tests/validation.test.js
git commit -m "feat: implement input validation and parsing"
```

---

### Task 3: Glob Pattern Parsing and Directory Filtering

**Files:**
- Modify: `scripts/upload.js`
- Test: `tests/glob.test.js`

**Step 1: Write the failing test**
Create `tests/glob.test.js` that verifies file patterns are matched using `@actions/glob` while filtering out directories:
```javascript
import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import { resolveFiles } from '../scripts/upload.js';

test('resolves file paths and filters out directories', async () => {
  const files = await resolveFiles('test-resource/*');
  assert.strictEqual(files.length > 0, true);
  for (const f of files) {
    assert.strictEqual(fs.statSync(f).isFile(), true);
  }
});
```

**Step 2: Run test to verify it fails**
Run: `node --test tests/glob.test.js`
Expected: Fail (`resolveFiles` is not a function).

**Step 3: Write minimal implementation**
Modify `scripts/upload.js` to implement and export `resolveFiles` using `@actions/glob`:
```javascript
import glob from '@actions/glob';

export async function resolveFiles(artifactsPattern) {
  const globber = await glob.create(artifactsPattern);
  const matchedPaths = await globber.glob();
  const files = [];
  for (const p of matchedPaths) {
    if (fs.statSync(p).isFile()) {
      files.push(p);
    }
  }
  return files;
}
```

**Step 4: Run test to verify it passes**
Run: `node --test tests/glob.test.js`
Expected: Pass.

**Step 5: Commit**
```bash
git add scripts/upload.js tests/glob.test.js
git commit -m "feat: add glob resolver with directory filtering"
```

---

### Task 4: Upload Request and Retry Logic

**Files:**
- Modify: `scripts/upload.js`
- Test: `tests/upload-file.test.js`

**Step 1: Write the failing test**
Create `tests/upload-file.test.js` to test single file upload with standard `fetch` mock and retries:
```javascript
import test from 'node:test';
import assert from 'node:assert';
import { uploadFile } from '../scripts/upload.js';

test('uploads single file successfully with token and fileInfo', async (t) => {
  const mockFetch = t.mock.method(globalThis, 'fetch', () => {
    return Promise.resolve(new Response(JSON.stringify([{ id: 123, url: 'http://example.com' }]), { status: 200 }));
  });

  const result = await uploadFile('test-resource/sample.html', {
    token: 'my-token',
    folderId: '190',
    endpoint: 'http://example.com/upload',
    retries: 3
  });

  assert.strictEqual(result.id, 123);
  assert.strictEqual(mockFetch.mock.callCount(), 1);
});

test('retries on failure up to max retries', async (t) => {
  let callCount = 0;
  t.mock.method(globalThis, 'fetch', () => {
    callCount++;
    if (callCount < 3) {
      return Promise.resolve(new Response('Error', { status: 500 }));
    }
    return Promise.resolve(new Response(JSON.stringify([{ id: 456 }]), { status: 200 }));
  });

  const result = await uploadFile('test-resource/sample.html', {
    token: 'my-token',
    folderId: '190',
    endpoint: 'http://example.com/upload',
    retries: 3
  });

  assert.strictEqual(result.id, 456);
  assert.strictEqual(callCount, 3);
});
```

**Step 2: Run test to verify it fails**
Run: `node --test tests/upload-file.test.js`
Expected: Fail (`uploadFile` not defined).

**Step 3: Write minimal implementation**
Implement `uploadFile` inside `scripts/upload.js`:
```javascript
export async function uploadFile(filePath, { token, folderId, endpoint, retries }) {
  const fileName = path.basename(filePath);
  const formData = new FormData();
  const fileContent = fs.readFileSync(filePath);
  const fileBlob = new Blob([fileContent]);
  formData.append('files', fileBlob, fileName);
  formData.append('fileInfo', JSON.stringify({ name: fileName, folder: folderId }));

  let attempt = 0;
  const maxAttempts = 1 + retries;

  while (attempt < maxAttempts) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: token,
        },
        body: formData,
      });

      if (!response.ok) {
        const bodyText = await response.text();
        const excerpt = bodyText.substring(0, 100);
        throw new Error(`Upload failed with status: ${response.status}. Response: ${excerpt}`);
      }

      const responseData = await response.json();
      if (!responseData || !responseData[0]) {
        throw new Error('Upload succeeded but returned empty list');
      }

      return responseData[0];
    } catch (err) {
      attempt++;
      console.log(`Attempt ${attempt} failed for ${fileName}:`, err.message);
      if (attempt >= maxAttempts) {
        throw err;
      }
    }
  }
}
```

**Step 4: Run test to verify it passes**
Run: `node --test tests/upload-file.test.js`
Expected: Pass.

**Step 5: Commit**
```bash
git add scripts/upload.js tests/upload-file.test.js
git commit -m "feat: implement single file upload with retries"
```

---

### Task 5: Create Update Record Logic

**Files:**
- Modify: `scripts/upload.js`
- Test: `tests/updates.test.js`

**Step 1: Write the failing test**
Create `tests/updates.test.js` to test creating the update record:
```javascript
import test from 'node:test';
import assert from 'node:assert';
import { createUpdateRecord } from '../scripts/upload.js';

test('creates update record successfully and returns record info', async (t) => {
  const mockFetch = t.mock.method(globalThis, 'fetch', (url, options) => {
    if (url.includes('/updates/')) {
      return Promise.resolve(new Response(JSON.stringify({
        data: { id: 99, attributes: { slug: 'my-slug' } }
      }), { status: 200 }));
    }
    // POST request
    return Promise.resolve(new Response(JSON.stringify({
      data: { id: 99 }
    }), { status: 200 }));
  });

  const otaFiles = [{ type: 'app.exe', file: { id: 123 } }];
  const result = await createUpdateRecord({
    endpoint: 'http://example.com/v1/upload',
    token: 'my-token',
    productId: '230',
    version: '1.0.2',
    changelog: 'Test changelog',
    state: 'alpha',
    type: 'optional',
    productSlug: 'nearhub-launch-windows',
    otaFiles
  });

  assert.strictEqual(result.id, 99);
  assert.strictEqual(result.slug, 'my-slug');
  assert.strictEqual(mockFetch.mock.callCount(), 2); // 1 POST, 1 GET
});
```

**Step 2: Run test to verify it fails**
Run: `node --test tests/updates.test.js`
Expected: Fail (`createUpdateRecord` not defined).

**Step 3: Write minimal implementation**
Implement `createUpdateRecord` inside `scripts/upload.js`:
```javascript
export async function createUpdateRecord({
  endpoint,
  token,
  productId,
  version,
  changelog,
  state,
  type,
  productSlug,
  otaFiles
}) {
  const baseEndpoint = endpoint.endsWith('/upload')
    ? endpoint.replace(/\/upload$/, '/updates')
    : endpoint + '/updates';

  const date = new Date().toISOString();
  const slug = `${productSlug}-${version}__${date}`;

  const payload = {
    slug,
    version,
    date,
    state,
    type,
    products: {
      disconnect: [],
      connect: [
        {
          id: parseInt(productId, 10),
          position: {
            end: true
          }
        }
      ]
    },
    descriptions: [
      {
        locale: 'en-us',
        content: changelog
      },
      {
        locale: 'zh-cn',
        content: changelog
      }
    ],
    otaFiles,
    imgFiles: [],
    extFiles: []
  };

  // POST request
  const postResponse = await fetch(baseEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token
    },
    body: JSON.stringify({ data: payload })
  });

  if (!postResponse.ok) {
    const errorBody = await postResponse.text();
    throw new Error(`Failed to create update record. Status: ${postResponse.status}. Response: ${errorBody.substring(0, 100)}`);
  }

  const postResult = await postResponse.json();
  const newId = postResult.data.id;

  // GET request
  const getResponse = await fetch(`${baseEndpoint}/${newId}?populate[otaFiles][populate]=*`, {
    headers: {
      Authorization: token
    }
  });

  if (!getResponse.ok) {
    const errorBody = await getResponse.text();
    throw new Error(`Failed to fetch populated update record. Status: ${getResponse.status}. Response: ${errorBody.substring(0, 100)}`);
  }

  const getResult = await getResponse.json();
  return {
    ...getResult.data.attributes,
    id: getResult.data.id
  };
}
```

**Step 4: Run test to verify it passes**
Run: `node --test tests/updates.test.js`
Expected: Pass.

**Step 5: Commit**
```bash
git add scripts/upload.js tests/updates.test.js
git commit -m "feat: implement update record creation and fetch logic"
```

---

### Task 6: Batch Processing, Outputs, and `if-no-files-found` Handling

**Files:**
- Modify: `scripts/upload.js`
- Test: `tests/batch.test.js`

**Step 1: Write the failing test**
Create `tests/batch.test.js`:
```javascript
import test from 'node:test';
import assert from 'node:assert';
import { run } from '../scripts/upload.js';

test('throws error if no files found and if-no-files-found is error', async () => {
  const env = {
    INPUT_TOKEN: 'token',
    INPUT_ARTIFACTS: 'nonexistent-pattern/*',
    INPUT_FOLDER_ID: '190',
    INPUT_PRODUCT_ID: '230',
    INPUT_VERSION: '1.0.2',
    INPUT_IF_NO_FILES_FOUND: 'error'
  };

  await assert.rejects(run(env), /No files found/);
});
```

**Step 2: Run test to verify it fails**
Run: `node --test tests/batch.test.js`
Expected: Fail (doesn't throw correct error or function not set up to process files).

**Step 3: Write minimal implementation**
Update `run(env)` in `scripts/upload.js` to coordinate the flow:
```javascript
import * as core from '@actions/core';

export async function run(env = process.env) {
  const token = env.INPUT_TOKEN;
  const artifacts = env.INPUT_ARTIFACTS;
  const folderId = env.INPUT_FOLDER_ID;
  const productId = env.INPUT_PRODUCT_ID;
  const version = env.INPUT_VERSION;

  if (!token) throw new Error('Input required and not supplied: token');
  if (!artifacts) throw new Error('Input required and not supplied: artifacts');
  if (!folderId) throw new Error('Input required and not supplied: folder-id');
  if (!productId) throw new Error('Input required and not supplied: product-id');
  if (!version) throw new Error('Input required and not supplied: version');

  const endpoint = env.INPUT_ENDPOINT || 'https://mosapi-admin.auditoryworks.co/v1/upload';
  const ifNoFilesFound = env.INPUT_IF_NO_FILES_FOUND || 'error';
  const retries = parseInt(env.INPUT_RETRIES || '3', 10);

  // Changelog resolution rules:
  // 1. INPUT_CHANGELOG
  // 2. Read temp_changelog.txt if exists
  // 3. Default text
  let changelog = env.INPUT_CHANGELOG;
  if (!changelog) {
    const tempPath = path.resolve(process.cwd(), 'temp_changelog.txt');
    if (fs.existsSync(tempPath)) {
      changelog = fs.readFileSync(tempPath, 'utf-8');
    } else {
      changelog = 'New release with several bug fixes and improvements.';
    }
  }

  const state = env.INPUT_STATE || 'alpha';
  const type = env.INPUT_TYPE || 'optional';
  const productSlug = env.INPUT_PRODUCT_SLUG || 'nearhub-launch-windows';

  const files = await resolveFiles(artifacts);

  if (files.length === 0) {
    if (ifNoFilesFound === 'error') {
      throw new Error('No files found matching the specified pattern.');
    } else if (ifNoFilesFound === 'warn') {
      core.warning('No files found matching the specified pattern.');
    } else {
      core.info('No files found matching the specified pattern.');
    }
    core.setOutput('uploaded-count', 0);
    core.setOutput('uploaded-files', JSON.stringify([]));
    return;
  }

  core.info(`Found ${files.length} file(s) to upload.`);
  const uploadedFilesResult = [];
  const otaFiles = [];

  for (const file of files) {
    core.info(`Uploading ${file}...`);
    const result = await uploadFile(file, { token, folderId, endpoint, retries });
    core.info(`Uploaded ${file} -> id=${result.id}`);
    uploadedFilesResult.push({
      path: file,
      name: path.basename(file),
      id: result.id,
      url: result.url,
      ...result
    });
    otaFiles.push({
      type: path.basename(file),
      file: { id: result.id }
    });
  }

  core.info(`Uploaded ${files.length} file(s) successfully.`);
  core.setOutput('uploaded-count', files.length);
  core.setOutput('uploaded-files', JSON.stringify(uploadedFilesResult));

  core.info('Creating update record on Mosapi...');
  const updateRecord = await createUpdateRecord({
    endpoint,
    token,
    productId,
    version,
    changelog,
    state,
    type,
    productSlug,
    otaFiles
  });

  core.info(`Created update record successfully. ID: ${updateRecord.id}, Slug: ${updateRecord.slug}`);
  core.setOutput('update-id', updateRecord.id);
  core.setOutput('update-slug', updateRecord.slug);
}

if (process.argv[1] && (process.argv[1].endsWith('upload.js') || process.argv[1].endsWith('upload'))) {
  run().catch(err => {
    core.setFailed(err.message);
  });
}
```

**Step 4: Run test to verify it passes**
Run: `node --test`
Expected: All tests pass.

**Step 5: Commit**
```bash
git add scripts/upload.js tests/batch.test.js
git commit -m "feat: complete batch uploads, output settings, and update record creation"
```

---

### Task 7: Update Action Metadata (`action.yaml`)

**Files:**
- Modify: `action.yaml`

**Step 1: Write the failing test**
None.

**Step 2: Run test to verify it fails**
None.

**Step 3: Write minimal implementation**
Replace `action.yaml` with the inputs and runs schema for Mosapi upload composite action:
```yaml
name: 'Mosapi Upload Action'
description: 'Upload build artifacts to a Mosapi CMS asset folder and create update record'
author: 'Lichenghuan'
branding:
  icon: 'upload-cloud'
  color: 'blue'
inputs:
  token:
    required: true
    description: 'Mosapi authorization token'
  artifacts:
    required: true
    description: 'Glob patterns for files to upload'
  folder-id:
    required: true
    description: 'Mosapi CMS asset folder id'
  product-id:
    required: true
    description: 'Mosapi product ID to associate the update with'
  version:
    required: true
    description: 'Release version'
  endpoint:
    required: false
    default: 'https://mosapi-admin.auditoryworks.co/v1/upload'
    description: 'Mosapi upload endpoint'
  if-no-files-found:
    required: false
    default: 'error'
    description: 'Action when no files match: error, warn, or ignore'
  retries:
    required: false
    default: '3'
    description: 'Upload retry count per file'
  changelog:
    required: false
    description: 'Changelog description for the update record. If empty, reads from temp_changelog.txt or uses default.'
  state:
    required: false
    default: 'alpha'
    description: 'Update state (alpha, beta, release)'
  type:
    required: false
    default: 'optional'
    description: 'Update type (optional, force)'
  product-slug:
    required: true
    description: 'Product slug prefix for the update name'
outputs:
  uploaded-count:
    description: 'Number of files uploaded successfully'
  uploaded-files:
    description: 'JSON array containing local file metadata and Mosapi response fields'
  update-id:
    description: 'ID of the created Mosapi update record'
  update-slug:
    description: 'Slug of the created Mosapi update record'
runs:
  using: composite
  steps:
    - name: Install dependencies
      run: npm ci --omit=dev
      shell: bash
      working-directory: ${{ github.action_path }}
    - name: Run Upload Script
      run: node ${{ github.action_path }}/scripts/upload.js
      shell: bash
```

**Step 4: Run test to verify it passes**
Verify that `action.yaml` parsing is correct.

**Step 5: Commit**
```bash
git add action.yaml
git commit -m "feat: update action.yaml schema for update record creation"
```

---

### Task 8: Local Integration Testing with Act

**Files:**
- Modify: `.github/workflows/test_with_local_actions.yaml`
- Local only: `my.secrets`
- Local only: `my.variables`

**Step 1: Write the failing test**
Update `.github/workflows/test_with_local_actions.yaml` to use the new inputs:
```yaml
name: Test

on: [push, pull_request]

jobs:
  main:
    runs-on: ubuntu-latest

    steps:
    - name: Checkout repository
      uses: actions/checkout@v3

    - name: Upload test artifacts to Mosapi
      uses: ./
      with:
        token: ${{ secrets.MOSAPI_TOKEN }}
        folder-id: ${{ vars.MOSAPI_FOLDER_ID }}
        product-id: ${{ vars.MOSAPI_PRODUCT_ID }}
        version: '1.0.2'
        artifacts: |
          test-resource/*
```
Run `act` locally:
```bash
act --container-architecture linux/amd64 --input trigger=manually --secret-file my.secrets --var-file my.variables -W .github/workflows/test_with_local_actions.yaml
```
Expected: Fail (credentials not configured).

**Step 2: Run test to verify it fails**
Verify `act` fails.

**Step 3: Write minimal implementation**
Create local-only `my.secrets` and `my.variables` files with test environment variables. These files are ignored by git and must not be committed.
`my.secrets`:
```text
MOSAPI_TOKEN=your-token-here
```
`my.variables`:
```text
MOSAPI_FOLDER_ID=190
MOSAPI_PRODUCT_ID=230
```

**Step 4: Run test to verify it passes**
Run the `act` command with actual credentials to verify the upload is successful.

**Step 5: Commit**
```bash
git add .github/workflows/test_with_local_actions.yaml
git commit -m "test: configure workflow for integration testing"
```

---

### Task 9: Update Documentation (README.md & AGENTS.md)

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`

**Step 1: Write the failing test**
None.

**Step 2: Run test to verify it fails**
None.

**Step 3: Write minimal implementation**
Update `README.md` and `AGENTS.md` to document the new Mosapi Upload & Update Action structure, all inputs, outputs, usage examples, and local development testing steps.

**Step 4: Run test to verify it passes**
Review the updated markdown documents to ensure formatting and contents are correct.

**Step 5: Commit**
```bash
git add README.md AGENTS.md
git commit -m "docs: update README.md and AGENTS.md for Mosapi upload and update action"
```
