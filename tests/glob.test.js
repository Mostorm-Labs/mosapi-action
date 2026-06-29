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
