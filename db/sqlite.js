/**
 * SQLite through Node's built-in `node:sqlite`, with the small part of the
 * better-sqlite3 API LearnOS uses: prepare().get/all/run, exec, pragma and
 * transaction.
 *
 * better-sqlite3 is a native addon compiled for one Node ABI. Every Node
 * upgrade broke a working install ("was compiled against a different Node.js
 * version") until the learner ran `npm rebuild`, and a fresh install needed a
 * C++ toolchain wherever no prebuilt binary existed. node:sqlite ships with
 * Node (22.13+), so there is nothing to compile and nothing to break.
 *
 * Three behaviours are bridged:
 * - better-sqlite3 ignores object keys a statement does not use; node:sqlite
 *   throws "Unknown named parameter". Keys are filtered to the statement's own.
 * - better-sqlite3 takes one array argument as the list of positional values.
 * - better-sqlite3 binds booleans as errors and node:sqlite as 1/0; both are
 *   fine for LearnOS, which never relies on the error.
 */
import { createRequire } from 'node:module';

// Loaded through require: test tooling built on older Vite does not know
// node:sqlite is a builtin and strips the prefix from a static import.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');

const PARAM = /[@:$]([A-Za-z_][A-Za-z0-9_]*)/g;

class Statement {
  constructor(stmt, sql) {
    this.stmt = stmt;
    this.names = new Set([...String(sql).matchAll(PARAM)].map(m => m[1]));
  }
  args(params) {
    if (params.length === 1 && params[0] && typeof params[0] === 'object' && !Array.isArray(params[0]) && !(params[0] instanceof Uint8Array)) {
      const src = params[0];
      const named = {};
      for (const k of Object.keys(src)) if (this.names.has(k)) named[k] = src[k] === undefined ? null : src[k];
      return [named];
    }
    // better-sqlite3 also takes one array as the list of positional values.
    const list = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    return list.map(v => (v === undefined ? null : v));
  }
  get(...params) { return this.stmt.get(...this.args(params)); }
  all(...params) { return this.stmt.all(...this.args(params)); }
  run(...params) { return this.stmt.run(...this.args(params)); }
}

export default class Database {
  constructor(path) {
    this.db = new DatabaseSync(path);
    this.depth = 0;
  }
  prepare(sql) { return new Statement(this.db.prepare(sql), sql); }
  exec(sql) { this.db.exec(sql); return this; }
  pragma(text) { return this.db.prepare(`PRAGMA ${text}`).all(); }
  close() { this.db.close(); }
  /** Like better-sqlite3: returns a function that runs `fn` atomically; nests via savepoints. */
  transaction(fn) {
    return (...args) => {
      const sp = `lo_tx_${this.depth}`;
      this.db.exec(this.depth === 0 ? 'BEGIN' : `SAVEPOINT ${sp}`);
      this.depth++;
      try {
        const result = fn(...args);
        this.depth--;
        this.db.exec(this.depth === 0 ? 'COMMIT' : `RELEASE ${sp}`);
        return result;
      } catch (e) {
        this.depth--;
        this.db.exec(this.depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${sp}; RELEASE ${sp}`);
        throw e;
      }
    };
  }
}
