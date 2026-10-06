import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from '../src/server.js';
import { ProjectStore } from '../src/store.js';

let server, base, dir;

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'project-list-'));
  server = createServer(new ProjectStore(path.join(dir, 'projects.json')));
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://localhost:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(dir, { recursive: true, force: true });
});

const json = (method, url, body) =>
  fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });

test('CRUD lifecycle', async () => {
  assert.deepEqual(await (await json('GET', '/api/projects')).json(), []);

  const created = await json('POST', '/api/projects', { name: '  Alpha ', description: 'first' });
  assert.equal(created.status, 201);
  const project = await created.json();
  assert.equal(project.name, 'Alpha');
  assert.equal(project.status, 'planned');

  const patched = await json('PATCH', `/api/projects/${project.id}`, { status: 'active' });
  assert.equal((await patched.json()).status, 'active');

  const fetched = await (await json('GET', `/api/projects/${project.id}`)).json();
  assert.equal(fetched.description, 'first');
  assert.equal(fetched.status, 'active');

  assert.equal((await json('DELETE', `/api/projects/${project.id}`)).status, 204);
  assert.equal((await json('GET', `/api/projects/${project.id}`)).status, 404);
  assert.equal((await json('DELETE', `/api/projects/${project.id}`)).status, 404);
});

test('validation errors', async () => {
  assert.equal((await json('POST', '/api/projects', { name: '   ' })).status, 400);
  assert.equal((await json('POST', '/api/projects', { name: 'x', status: 'bogus' })).status, 400);
  const bad = await fetch(base + '/api/projects', { method: 'POST', body: '{nope' });
  assert.equal(bad.status, 400);
});

test('concurrent creates are all persisted', async () => {
  const before = (await (await json('GET', '/api/projects')).json()).length;
  await Promise.all(Array.from({ length: 10 }, (_, i) => json('POST', '/api/projects', { name: `p${i}` })));
  const after = (await (await json('GET', '/api/projects')).json()).length;
  assert.equal(after - before, 10);
});

test('serves the web UI and blocks path traversal', async () => {
  const page = await fetch(base + '/');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Project List/);
  const res = await fetch(base + '/..%2fpackage.json');
  assert.equal(res.status, 404);
});
