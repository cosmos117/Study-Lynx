import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Config is read at import time, so set it before the app loads.
process.env.JWT_SECRET = 'test-secret-for-app-smoke-tests';

const { default: app } = await import('./app.js');
const { createToken } = await import('./utils/jwt.js');

let server;
let base;
const auth = () => ({ Authorization: `Bearer ${createToken(7)}` });

beforeAll(async () => {
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));

function multipart(filename, type, content) {
  const form = new FormData();
  form.append('file', new Blob([content], { type }), filename);
  return form;
}

describe('app wiring', () => {
  it('boots and serves the health check', async () => {
    const response = await fetch(`${base}/api/health`);
    expect(response.status).toBe(200);
  });

  it.each([
    ['GET', '/api/documents'],
    ['POST', '/api/documents'],
    ['POST', '/api/documents/text'],
    ['GET', '/api/documents/1'],
    ['GET', '/api/documents/1/chunks'],
    ['DELETE', '/api/documents/1'],
    ['PATCH', '/api/documents/1/topic'],
    ['POST', '/api/ai-tutor/ask'],
  ])('%s %s requires authentication', async (method, path) => {
    const response = await fetch(`${base}${path}`, { method });
    expect(response.status).toBe(401);
  });

  it('rejects an unsupported upload type before touching the database', async () => {
    const response = await fetch(`${base}/api/documents`, {
      method: 'POST', headers: auth(), body: multipart('evil.exe', 'application/x-msdownload', 'MZ'),
    });
    expect(response.status).toBe(415);
  });

  it('rejects an upload request that has no file', async () => {
    const response = await fetch(`${base}/api/documents`, { method: 'POST', headers: auth(), body: new FormData() });
    expect(response.status).toBe(400);
  });

  it('rejects an oversized upload', async () => {
    const big = new Uint8Array(11 * 1024 * 1024);
    const response = await fetch(`${base}/api/documents`, {
      method: 'POST', headers: auth(), body: multipart('big.pdf', 'application/pdf', big),
    });
    expect(response.status).toBe(413);
  });

  it('validates pasted-text and tutor request bodies', async () => {
    const headers = { ...auth(), 'Content-Type': 'application/json' };
    const badText = await fetch(`${base}/api/documents/text`, { method: 'POST', headers, body: JSON.stringify({ name: 'x', type: 'PDF', text: 'y' }) });
    expect(badText.status).toBe(400);
    const badQuestion = await fetch(`${base}/api/ai-tutor/ask`, { method: 'POST', headers, body: JSON.stringify({ question: '   ' }) });
    expect(badQuestion.status).toBe(400);
    const badMode = await fetch(`${base}/api/ai-tutor/ask`, { method: 'POST', headers, body: JSON.stringify({ question: 'q', mode: 'hack' }) });
    expect(badMode.status).toBe(400);
  });

  it('rejects a non-numeric document id', async () => {
    const response = await fetch(`${base}/api/documents/abc`, { headers: auth() });
    expect(response.status).toBe(400);
  });
});
