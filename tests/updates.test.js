import test from 'node:test';
import assert from 'node:assert';
import { createUpdateRecord } from '../scripts/upload.js';

test('creates update record successfully and returns record info', async (t) => {
  let postBody = null;
  const mockFetch = t.mock.method(globalThis, 'fetch', (url, options) => {
    if (url.includes('/updates/')) {
      return Promise.resolve(new Response(JSON.stringify({
        data: { id: 99, attributes: { slug: 'my-slug' } }
      }), { status: 200 }));
    }
    // POST request
    postBody = JSON.parse(options.body);
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
  assert.strictEqual(postBody.data.version, '1.0.2');
  assert.strictEqual(postBody.data.products.connect[0].id, 230);
  assert.strictEqual(postBody.data.otaFiles[0].file.id, 123);
});
