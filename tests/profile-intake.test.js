import { describe, it, expect, beforeAll } from 'vitest';
import db from '../db/database.js';
import { persistProfile, getProfile } from '../ai/agents/profiling.js';

/**
 * Regression cover for the intake crash that broke onboarding for every
 * first-time user.
 *
 * The UI sends `learning_style` as an ARRAY of selected chips, but
 * profileSchema declares it a string, so only the LLM path produced the
 * expected shape. Without an API key the heuristic path passed the raw array to
 * better-sqlite3 — which treats an array argument as a LIST of bind parameters
 * rather than one value. The parameter count silently changed and intake died
 * with "Too many parameter values were provided", a message that points at
 * nothing. Onboarding was unreachable for anyone without a key.
 *
 * These tests pin the shapes that actually reach the database.
 */
const USER = 'test-profile-user';

beforeAll(() => {
  db.prepare("INSERT OR IGNORE INTO users (id, name, email, role) VALUES (?, 'Test', 'test@localhost', 'user')").run(USER);
});

const cleanup = () => db.prepare('DELETE FROM user_profiles WHERE user_id = ?').run(USER);

describe('persistProfile parameter binding', () => {
  it('accepts learning_style as an array (what the onboarding UI sends)', () => {
    cleanup();
    expect(() => persistProfile(USER, 'Machine Learning', {
      background: 'Backend engineer',
      level: 'beginner',
      time_per_week: 5,
      learning_style: ['Visual examples', 'Hands-on projects'],
      motivations: [],
    })).not.toThrow();

    expect(getProfile(USER).learning_style).toBe('Visual examples, Hands-on projects');
  });

  it('accepts learning_style as a string (what the model returns)', () => {
    cleanup();
    persistProfile(USER, 'ML', { level: 'advanced', time_per_week: 9, learning_style: 'theory first', motivations: [] });
    expect(getProfile(USER).learning_style).toBe('theory first');
  });

  it('survives an empty array without changing the parameter count', () => {
    cleanup();
    // An empty array binds ZERO parameters, which fails just as hard as too many.
    expect(() => persistProfile(USER, 'ML', { learning_style: [], motivations: [] })).not.toThrow();
    expect(getProfile(USER).learning_style).toBe('hands-on');
  });

  it('never lets a nested object reach the driver as a bind value', () => {
    cleanup();
    expect(() => persistProfile(USER, 'ML', {
      background: { note: 'unexpected shape' },
      learning_style: ['visual'],
      motivations: [],
    })).not.toThrow();
    expect(typeof getProfile(USER).background).toBe('string');
  });

  it('upserts rather than duplicating on repeat intake', () => {
    cleanup();
    persistProfile(USER, 'First goal', { learning_style: ['a'], motivations: [] });
    persistProfile(USER, 'Second goal', { learning_style: ['b'], motivations: [] });
    const rows = db.prepare('SELECT COUNT(*) c FROM user_profiles WHERE user_id = ?').get(USER).c;
    expect(rows).toBe(1);
    expect(getProfile(USER).goal).toBe('Second goal');
  });

  it('round-trips motivations as JSON', () => {
    cleanup();
    persistProfile(USER, 'ML', { learning_style: 'visual', motivations: ['career change', 'curiosity'] });
    expect(getProfile(USER).motivations).toEqual(['career change', 'curiosity']);
    cleanup();
  });
});
