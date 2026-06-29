import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import { resolveFiles } from '../scripts/upload.js';

test('resolves file paths and filters out directories', async () => {
  const files = await resolveFiles('test-resource/dist/*');
  assert.strictEqual(files.length > 0, true);
  for (const f of files) {
    assert.strictEqual(fs.statSync(f).isFile(), true);
  }
});

test('handles exclusions and multiline patterns correctly', async () => {
  const pattern = `
    test-resource/dist/*.exe
    test-resource/dist/*.zip
    !test-resource/dist/*.map
  `;
  const files = await resolveFiles(pattern);
  assert.strictEqual(files.length, 2);
  const fileNames = files.map(f => f.replace(/\\/g, '/').split('/').pop());
  assert.strictEqual(fileNames.includes('launcher-setup.exe'), true);
  assert.strictEqual(fileNames.includes('launcher-mac.zip'), true);
  assert.strictEqual(fileNames.includes('launcher-mac.map'), false);
});
