import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Config is read at import time, so set it before the app loads.
process.env.JWT_SECRET = 'test-secret-for-app-smoke-tests';
// Empty (not unset) so a developer's local .env cannot switch Google sign-in on during tests.
process.env.GOOGLE_CLIENT_ID = '';

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

describe('google sign-in', () => {
  const post = (body) => fetch(`${base}/api/auth/google`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });

  it('rejects a request without a credential', async () => {
    expect((await post({})).status).toBe(400);
  });

  it('reports when Google sign-in is not configured', async () => {
    expect((await post({ credential: 'x'.repeat(40) })).status).toBe(503);
  });
});

describe('dashboard endpoints', () => {
  it.each([
    '/api/overview',
    '/api/analytics',
    '/api/subjects',
    '/api/flashcards/due/count',
    '/api/motivation/today',
    '/api/study-sessions/today',
  ])('GET %s requires authentication', async (path) => {
    expect((await fetch(`${base}${path}`)).status).toBe(401);
  });

  it('rejects a forged or malformed token', async () => {
    const response = await fetch(`${base}/api/overview`, { headers: { Authorization: 'Bearer not-a-real-token' } });
    expect(response.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const expired = jwt.sign({ sub: '7' }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: -10 });
    const response = await fetch(`${base}/api/overview`, { headers: { Authorization: `Bearer ${expired}` } });
    expect(response.status).toBe(401);
  });

  it.each(['3', '91', 'abc'])('rejects analytics days=%s before touching the database', async (days) => {
    const response = await fetch(`${base}/api/analytics?days=${days}`, { headers: auth() });
    expect(response.status).toBe(400);
  });

  it("serves today's study quote to a signed-in user", async () => {
    const response = await fetch(`${base}/api/motivation/today`, { headers: auth() });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(typeof body.data.motivation).toBe('string');
    expect(body.data.motivation.length).toBeGreaterThan(10);
  });
});

describe('subjects endpoints', () => {
  const send = (method, path, body) => fetch(`${base}${path}`, {
    method, headers: { ...auth(), 'Content-Type': 'application/json' }, body: body && JSON.stringify(body),
  });

  it.each([
    ['POST', '/api/subjects'],
    ['PUT', '/api/subjects/1'],
    ['DELETE', '/api/subjects/1'],
  ])('%s %s requires authentication', async (method, path) => {
    expect((await fetch(`${base}${path}`, { method })).status).toBe(401);
  });

  it.each([
    ['an empty name', { name: '   ' }],
    ['an invalid exam date', { name: 'Databases', examDate: 'not-a-date' }],
  ])('rejects a subject with %s before touching the database', async (_label, body) => {
    expect((await send('POST', '/api/subjects', body)).status).toBe(400);
  });

  it('rejects an update with no fields', async () => {
    expect((await send('PUT', '/api/subjects/1', {})).status).toBe(400);
  });

  it.each(['/api/exams', '/api/dashboard/summary', '/api/study-sessions/generate'])('%s no longer exists', async (path) => {
    const response = await fetch(`${base}${path}`, { method: path.endsWith('generate') ? 'POST' : 'GET', headers: auth() });
    expect(response.status).toBe(404);
  });
});

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
    ['DELETE', '/api/topics/1/quiz'],
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
