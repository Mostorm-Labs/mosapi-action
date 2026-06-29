import test from 'node:test';
import assert from 'node:assert';
import { uploadFile } from '../scripts/upload.js';

test('uploads single file successfully with token and fileInfo', async (t) => {
  const mockFetch = t.mock.method(globalThis, 'fetch', () => {
    return Promise.resolve(new Response(JSON.stringify([{ id: 123, url: 'http://example.com' }]), { status: 200 }));
  });

  const result = await uploadFile('test-resource/dist/launcher-setup.exe', {
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

  const result = await uploadFile('test-resource/dist/launcher-setup.exe', {
    token: 'my-token',
    folderId: '190',
    endpoint: 'http://example.com/upload',
    retries: 3
  });

  assert.strictEqual(result.id, 456);
  assert.strictEqual(callCount, 3);
});
