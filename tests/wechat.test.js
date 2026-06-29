import test from 'node:test';
import assert from 'node:assert';
import { getAbsoluteUrl, sendWeChatNotification } from '../scripts/upload.js';

test('getAbsoluteUrl computes absolute URLs correctly', () => {
  const endpoint = 'https://mosapi-admin.auditoryworks.co/v1/upload';
  
  // Case 1: Already absolute
  assert.strictEqual(
    getAbsoluteUrl('https://example.com/file.exe', endpoint),
    'https://example.com/file.exe'
  );
  assert.strictEqual(
    getAbsoluteUrl('http://example.com/file.zip', endpoint),
    'http://example.com/file.zip'
  );

  // Case 2: Relative URL
  assert.strictEqual(
    getAbsoluteUrl('/uploads/file.exe', endpoint),
    'https://mosapi-admin.auditoryworks.co/uploads/file.exe'
  );

  // Case 3: Invalid endpoint fallback
  assert.strictEqual(
    getAbsoluteUrl('/uploads/file.exe', 'invalid-endpoint'),
    '/uploads/file.exe'
  );
});

test('sendWeChatNotification sends structured markdown message', async (t) => {
  let webhookUrl = '';
  let postBody = null;

  t.mock.method(globalThis, 'fetch', (url, options) => {
    webhookUrl = url;
    postBody = JSON.parse(options.body);
    return Promise.resolve(new Response(JSON.stringify({ errcode: 0, errmsg: 'ok' }), { status: 200 }));
  });

  const result = await sendWeChatNotification({
    webhookKey: 'mockkey123',
    projectName: 'MyTestProject',
    version: '1.0.9',
    uploadedFiles: [
      { name: 'app.exe', url: '/uploads/app.exe' }
    ],
    updateRecord: { id: 777 },
    changelog: 'Added WeChat Enterprise robot support',
    endpoint: 'https://mosapi.example.com/v1/upload'
  });

  assert.strictEqual(webhookUrl, 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=mockkey123');
  assert.strictEqual(result.errmsg, 'ok');
  assert.strictEqual(postBody.msgtype, 'markdown');
  
  const content = postBody.markdown.content;
  assert.match(content, /\*\*项目名称\*\*：MyTestProject/);
  assert.match(content, /\*\*版本号\*\*：1\.0\.9/);
  assert.match(content, /\[app\.exe\]\(https:\/\/mosapi\.example\.com\/uploads\/app\.exe\)/);
  assert.match(content, /\*\*管理后台\*\*：\[点击前往 Mosapi 查看\]\(https:\/\/mosapi\.example\.com\/admin\/content-manager\/collectionType\/api::update\.update\/777\)/);
  assert.match(content, /📝 本次更新内容/);
  assert.match(content, /Added WeChat Enterprise robot support/);
});
