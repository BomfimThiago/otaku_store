import { beforeEach, describe, expect, it } from 'vitest';

import { createUsersStore, hashPassword, UsersError } from '../src/data/users.js';
import type { UsersStore } from '../src/data/users.js';

function createIdGenerator(): () => string {
  let counter = 0;
  return () => {
    counter += 1;
    return `user-${counter}`;
  };
}

describe('createUsersStore', () => {
  let store: UsersStore;

  beforeEach(() => {
    store = createUsersStore({ generateId: createIdGenerator() });
  });

  describe('register', () => {
    it('returns a public user with no password hash', async () => {
      const user = await store.register({
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        password: 'password1',
      });

      expect(user).toEqual({ id: 'user-1', name: 'Ada Lovelace', email: 'ada@example.com' });
      expect(user).not.toHaveProperty('password');
      expect(user).not.toHaveProperty('passwordHash');
    });

    it('normalises the stored email with trim + lowercase', async () => {
      const user = await store.register({
        name: 'Ada Lovelace',
        email: '  Ada@Example.com  ',
        password: 'password1',
      });

      expect(user.email).toBe('ada@example.com');
    });

    it('throws UsersError with statusCode 409 and code EMAIL_TAKEN for a duplicate email', async () => {
      await store.register({ name: 'Ada', email: 'ada@example.com', password: 'password1' });

      expect.assertions(3);
      try {
        await store.register({ name: 'Ada 2', email: 'ada@example.com', password: 'password2' });
      } catch (error) {
        expect(error).toBeInstanceOf(UsersError);
        expect((error as UsersError).statusCode).toBe(409);
        expect((error as UsersError).code).toBe('EMAIL_TAKEN');
      }
    });

    it('treats the duplicate email check as case-insensitive and trimmed', async () => {
      await store.register({ name: 'Ada', email: 'ada@example.com', password: 'password1' });

      await expect(
        store.register({ name: 'Ada 2', email: '  ADA@Example.com  ', password: 'password2' }),
      ).rejects.toBeInstanceOf(UsersError);
    });
  });

  describe('password hashing', () => {
    it('stores the hash as salt:hash hex, not the plaintext password', async () => {
      const hash = await hashPassword('password1');

      expect(hash).not.toBe('password1');
      expect(hash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    });

    it('generates a different salt (and hash) for the same password', async () => {
      const first = await hashPassword('password1');
      const second = await hashPassword('password1');

      expect(first).not.toBe(second);
    });
  });

  describe('verifyCredentials', () => {
    it('returns the public user for the right password', async () => {
      const registered = await store.register({
        name: 'Ada',
        email: 'ada@example.com',
        password: 'password1',
      });

      const result = await store.verifyCredentials('ada@example.com', 'password1');

      expect(result).toEqual(registered);
    });

    it('is case-insensitive and trims the email', async () => {
      const registered = await store.register({
        name: 'Ada',
        email: 'ada@example.com',
        password: 'password1',
      });

      const result = await store.verifyCredentials('  Ada@Example.com  ', 'password1');

      expect(result).toEqual(registered);
    });

    it('returns null for a wrong password', async () => {
      await store.register({ name: 'Ada', email: 'ada@example.com', password: 'password1' });

      const result = await store.verifyCredentials('ada@example.com', 'wrong-password');

      expect(result).toBeNull();
    });

    it('returns null for an unknown email', async () => {
      const result = await store.verifyCredentials('nobody@example.com', 'password1');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('returns the public user for a known id', async () => {
      const registered = await store.register({
        name: 'Ada',
        email: 'ada@example.com',
        password: 'password1',
      });

      expect(store.findById(registered.id)).toEqual(registered);
    });

    it('returns null for an unknown id', () => {
      expect(store.findById('missing')).toBeNull();
    });
  });

  describe('sessions', () => {
    it('createSession returns an opaque id that getUserBySession resolves to the user', async () => {
      const user = await store.register({ name: 'Ada', email: 'ada@example.com', password: 'password1' });

      const sid = store.createSession(user.id);

      expect(typeof sid).toBe('string');
      expect(sid.length).toBeGreaterThan(0);
      expect(store.getUserBySession(sid)).toEqual(user);
    });

    it('generates distinct session ids across calls', async () => {
      const user = await store.register({ name: 'Ada', email: 'ada@example.com', password: 'password1' });

      const first = store.createSession(user.id);
      const second = store.createSession(user.id);

      expect(first).not.toBe(second);
    });

    it('returns null from getUserBySession for an unknown session id', () => {
      expect(store.getUserBySession('unknown-sid')).toBeNull();
    });

    it('deleteSession revokes the session so getUserBySession returns null afterwards', async () => {
      const user = await store.register({ name: 'Ada', email: 'ada@example.com', password: 'password1' });
      const sid = store.createSession(user.id);

      store.deleteSession(sid);

      expect(store.getUserBySession(sid)).toBeNull();
    });

    it('deleting an unknown session id is a no-op', () => {
      expect(() => store.deleteSession('unknown-sid')).not.toThrow();
    });
  });

  describe('isolation', () => {
    it('does not share state between two stores from createUsersStore()', async () => {
      const otherStore = createUsersStore({ generateId: createIdGenerator() });

      await store.register({ name: 'Ada', email: 'ada@example.com', password: 'password1' });

      expect(await otherStore.verifyCredentials('ada@example.com', 'password1')).toBeNull();
    });
  });
});
