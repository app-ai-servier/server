import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

export const STATUSES = ['planned', 'active', 'done'];

export class ValidationError extends Error {}

function validate(input, { partial = false } = {}) {
  const out = {};
  if (!partial || input.name !== undefined) {
    if (typeof input.name !== 'string' || !input.name.trim()) {
      throw new ValidationError('name is required');
    }
    out.name = input.name.trim();
  }
  if (input.description !== undefined) {
    if (typeof input.description !== 'string') {
      throw new ValidationError('description must be a string');
    }
    out.description = input.description.trim();
  }
  if (input.status !== undefined) {
    if (!STATUSES.includes(input.status)) {
      throw new ValidationError(`status must be one of: ${STATUSES.join(', ')}`);
    }
    out.status = input.status;
  }
  return out;
}

export class ProjectStore {
  constructor(file) {
    this.file = file;
    this.queue = Promise.resolve();
  }

  async #read() {
    try {
      return JSON.parse(await fs.readFile(this.file, 'utf8'));
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }

  async #write(projects) {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(projects, null, 2));
    await fs.rename(tmp, this.file);
  }

  // Serialize read-modify-write cycles so concurrent requests don't clobber each other.
  #exclusive(fn) {
    const run = this.queue.then(fn);
    this.queue = run.catch(() => {});
    return run;
  }

  list() {
    return this.#exclusive(() => this.#read());
  }

  get(id) {
    return this.#exclusive(async () => (await this.#read()).find((p) => p.id === id) ?? null);
  }

  create(input) {
    return this.#exclusive(async () => {
      const data = validate(input);
      const now = new Date().toISOString();
      const project = {
        id: randomUUID(),
        name: data.name,
        description: data.description ?? '',
        status: data.status ?? 'planned',
        createdAt: now,
        updatedAt: now,
      };
      const projects = await this.#read();
      projects.push(project);
      await this.#write(projects);
      return project;
    });
  }

  update(id, input) {
    return this.#exclusive(async () => {
      const data = validate(input, { partial: true });
      const projects = await this.#read();
      const project = projects.find((p) => p.id === id);
      if (!project) return null;
      Object.assign(project, data, { updatedAt: new Date().toISOString() });
      await this.#write(projects);
      return project;
    });
  }

  remove(id) {
    return this.#exclusive(async () => {
      const projects = await this.#read();
      const next = projects.filter((p) => p.id !== id);
      if (next.length === projects.length) return false;
      await this.#write(next);
      return true;
    });
  }
}
