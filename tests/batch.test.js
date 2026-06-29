import test from 'node:test';
import assert from 'node:assert';
import { run, actionCore } from '../scripts/upload.js';

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

test('does not throw and sets output if no files found and if-no-files-found is ignore', async (t) => {
  const env = {
    INPUT_TOKEN: 'token',
    INPUT_ARTIFACTS: 'nonexistent-pattern/*',
    INPUT_FOLDER_ID: '190',
    INPUT_PRODUCT_ID: '230',
    INPUT_VERSION: '1.0.2',
    INPUT_IF_NO_FILES_FOUND: 'ignore'
  };

  const outputs = {};
  t.mock.method(actionCore, 'setOutput', (name, value) => {
    outputs[name] = value;
  });

  t.mock.method(actionCore, 'info', () => {});
  t.mock.method(actionCore, 'warning', () => {});

  await run(env);
  assert.strictEqual(outputs['uploaded-count'], 0);
  assert.strictEqual(outputs['uploaded-files'], JSON.stringify([]));
});
