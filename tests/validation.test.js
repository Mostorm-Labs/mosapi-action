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
