import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ProjectStore, ValidationError } from './store.js';

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1e6) throw new ValidationError('request body too large');
  }
  try {
    const body = JSON.parse(raw || '{}');
    if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch {
    throw new ValidationError('invalid JSON body');
  }
}

async function serveStatic(res, pathname) {
  const rel = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = path.join(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return sendJson(res, 404, { error: 'not found' });
  try {
    const data = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    sendJson(res, 404, { error: 'not found' });
  }
}

export function createServer(store) {
  return http.createServer(async (req, res) => {
    try {
      const { pathname } = new URL(req.url, 'http://localhost');
      const match = pathname.match(/^\/api\/projects(?:\/([^/]+))?$/);

      if (!match) {
        if (req.method === 'GET') return await serveStatic(res, pathname);
        return sendJson(res, 404, { error: 'not found' });
      }

      const id = match[1];
      if (!id) {
        if (req.method === 'GET') return sendJson(res, 200, await store.list());
        if (req.method === 'POST') return sendJson(res, 201, await store.create(await readBody(req)));
        return sendJson(res, 405, { error: 'method not allowed' });
      }

      if (req.method === 'GET') {
        const project = await store.get(id);
        return project ? sendJson(res, 200, project) : sendJson(res, 404, { error: 'project not found' });
      }
      if (req.method === 'PUT' || req.method === 'PATCH') {
        const project = await store.update(id, await readBody(req));
        return project ? sendJson(res, 200, project) : sendJson(res, 404, { error: 'project not found' });
      }
      if (req.method === 'DELETE') {
        return (await store.remove(id))
          ? sendJson(res, 204)
          : sendJson(res, 404, { error: 'project not found' });
      }
      return sendJson(res, 405, { error: 'method not allowed' });
    } catch (err) {
      if (err instanceof ValidationError) return sendJson(res, 400, { error: err.message });
      console.error(err);
      sendJson(res, 500, { error: 'internal server error' });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 3000;
  const file = process.env.DATA_FILE || path.join(process.cwd(), 'data', 'projects.json');
  createServer(new ProjectStore(file)).listen(port, () => {
    console.log(`Project list running at http://localhost:${port}`);
  });
}
