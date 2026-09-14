// Shared client-side validation rules, kept in sync with the API's checks
// (see store/api/src/data/users.ts and store/api/src/routes/auth.ts) so the
// pages can reject invalid input before making a request.

export const PASSWORD_MIN_LENGTH = 8;

// A pragmatic check, not a full RFC 5322 validator — matches what the API's
// z.email() rejects for the obviously-invalid cases we care about here.
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

export function isValidPassword(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH && /[A-Za-z]/.test(password) && /\d/.test(password);
}
