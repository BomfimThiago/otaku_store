/**
 * In-memory users and sessions store.
 *
 * Rules:
 *  - Users are keyed by an opaque `id`. Email is normalised (trim + lowercase)
 *    before storage and comparison, so "Foo@Bar.com" and " foo@bar.com " are
 *    the same account.
 *  - Registering with an email that is already taken throws `UsersError`
 *    with statusCode 409 and code 'EMAIL_TAKEN'.
 *  - Passwords are never stored in plaintext. They are hashed with scrypt
 *    using a random 16-byte salt; the stored value is `saltHex:hashHex`.
 *  - `verifyCredentials` re-derives the key from the stored salt and
 *    compares it to the stored hash with `crypto.timingSafeEqual` (after
 *    checking the buffer lengths match, since `timingSafeEqual` throws on a
 *    length mismatch instead of returning false). It returns `null` for a
 *    wrong password or an unknown email — callers can't tell which.
 *  - Sessions are a second, independent map: an opaque session id (32 random
 *    bytes, hex) resolves to a user id. `deleteSession` revokes it.
 *  - Every value returned to callers is a `PublicUser` copy — the password
 *    hash never leaves this module.
 */
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

const SCRYPT_KEYLEN = 64;

export const PASSWORD_MIN_LENGTH = 8;

export interface PublicUser {
  id: string;
  name: string;
  email: string;
}

interface StoredUser extends PublicUser {
  passwordHash: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface UsersStoreOptions {
  generateId?: () => string;
}

export interface UsersStore {
  register(input: RegisterInput): Promise<PublicUser>;
  verifyCredentials(email: string, password: string): Promise<PublicUser | null>;
  findById(id: string): PublicUser | null;
  createSession(userId: string): string;
  getUserBySession(sid: string): PublicUser | null;
  deleteSession(sid: string): void;
}

export class UsersError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'UsersError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toPublicUser(user: StoredUser): PublicUser {
  return { id: user.id, name: user.name, email: user.email };
}

/** Derives a `saltHex:hashHex` string for `password`, never the plaintext. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, SCRYPT_KEYLEN)) as Buffer;
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

/** Re-derives the key from `stored`'s salt and compares it in constant time. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const derived = (await scrypt(password, salt, SCRYPT_KEYLEN)) as Buffer;

  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

export function createUsersStore(options: UsersStoreOptions = {}): UsersStore {
  const generateId = options.generateId ?? randomUUID;
  const usersById = new Map<string, StoredUser>();
  const userIdByEmail = new Map<string, string>();
  const sessions = new Map<string, string>();

  return {
    async register(input) {
      const email = normaliseEmail(input.email);
      if (userIdByEmail.has(email)) {
        throw new UsersError(409, 'EMAIL_TAKEN', `Email "${email}" is already registered`);
      }

      const passwordHash = await hashPassword(input.password);
      const user: StoredUser = { id: generateId(), name: input.name, email, passwordHash };
      usersById.set(user.id, user);
      userIdByEmail.set(email, user.id);
      return toPublicUser(user);
    },

    async verifyCredentials(email, password) {
      const userId = userIdByEmail.get(normaliseEmail(email));
      const user = userId ? usersById.get(userId) : undefined;
      if (!user) return null;

      const valid = await verifyPassword(password, user.passwordHash);
      return valid ? toPublicUser(user) : null;
    },

    findById(id) {
      const user = usersById.get(id);
      return user ? toPublicUser(user) : null;
    },

    createSession(userId) {
      const sid = randomBytes(32).toString('hex');
      sessions.set(sid, userId);
      return sid;
    },

    getUserBySession(sid) {
      const userId = sessions.get(sid);
      if (!userId) return null;
      const user = usersById.get(userId);
      return user ? toPublicUser(user) : null;
    },

    deleteSession(sid) {
      sessions.delete(sid);
    },
  };
}
