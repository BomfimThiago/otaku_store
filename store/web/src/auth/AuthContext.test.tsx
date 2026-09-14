import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LoginInput, RegisterInput, User } from '../api/types.js';
import { AuthProvider, useAuth } from './AuthContext.js';

vi.mock('../api/client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.js')>();
  return {
    ...actual,
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  };
});

const { ApiError, login, logout, me, register } = await import('../api/client.js');

const baseUser: User = { id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com' };

describe('AuthProvider / useAuth', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('starts loading and then exposes the user from me()', async () => {
    vi.mocked(me).mockResolvedValue(baseUser);

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(me).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toEqual(baseUser);
  });

  it('gives user null and does not throw when me() rejects with a 401 ApiError', async () => {
    const apiError = new ApiError(401, 'Unauthorized', 'Not authenticated');
    vi.mocked(me).mockRejectedValue(apiError);

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.user).toBeNull();
  });

  it('login sets the user', async () => {
    vi.mocked(me).mockRejectedValue(new ApiError(401, 'Unauthorized', 'Not authenticated'));
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    vi.mocked(login).mockResolvedValue(baseUser);
    const input: LoginInput = { email: 'ada@example.com', password: 'password1' };

    await act(async () => {
      await result.current.login(input);
    });

    expect(login).toHaveBeenCalledWith(input);
    expect(result.current.user).toEqual(baseUser);
  });

  it('register sets the user', async () => {
    vi.mocked(me).mockRejectedValue(new ApiError(401, 'Unauthorized', 'Not authenticated'));
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    vi.mocked(register).mockResolvedValue(baseUser);
    const input: RegisterInput = { name: 'Ada Lovelace', email: 'ada@example.com', password: 'password1' };

    await act(async () => {
      await result.current.register(input);
    });

    expect(register).toHaveBeenCalledWith(input);
    expect(result.current.user).toEqual(baseUser);
  });

  it('logout clears the user', async () => {
    vi.mocked(me).mockResolvedValue(baseUser);
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toEqual(baseUser);

    vi.mocked(logout).mockResolvedValue(undefined);

    await act(async () => {
      await result.current.logout();
    });

    expect(logout).toHaveBeenCalledTimes(1);
    expect(result.current.user).toBeNull();
  });

  it('throws a descriptive error when used outside an AuthProvider', () => {
    expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used within an AuthProvider');
  });
});
