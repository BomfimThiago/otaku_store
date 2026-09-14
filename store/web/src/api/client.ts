import type {
  AddToCartInput,
  ApiErrorBody,
  Cart,
  LoginInput,
  Product,
  ProductListParams,
  RegisterInput,
  UpdateCartItemInput,
  User,
} from './types.js';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ApiErrorBody['details'];

  constructor(status: number, code: string, message: string, details?: ApiErrorBody['details']) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (init?.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
  });

  if (!res.ok) {
    let body: ApiErrorBody | undefined;
    try {
      body = (await res.json()) as ApiErrorBody;
    } catch {
      body = undefined;
    }

    throw new ApiError(
      res.status,
      body?.error ?? res.statusText,
      body?.message ?? res.statusText,
      body?.details,
    );
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export function listProducts(params?: ProductListParams): Promise<Product[]> {
  const search = new URLSearchParams();
  if (params?.category !== undefined) {
    search.set('category', params.category);
  }
  if (params?.q !== undefined) {
    search.set('q', params.q);
  }

  const query = search.toString();
  const path = query ? `/api/products?${query}` : '/api/products';

  return request<Product[]>(path);
}

export function getProduct(slug: string): Promise<Product> {
  return request<Product>(`/api/products/${encodeURIComponent(slug)}`);
}

export function getCart(): Promise<Cart> {
  return request<Cart>('/api/cart');
}

export function addToCart(input: AddToCartInput): Promise<Cart> {
  return request<Cart>('/api/cart', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateCartItem(itemId: string, input: UpdateCartItemInput): Promise<Cart> {
  return request<Cart>(`/api/cart/${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function removeCartItem(itemId: string): Promise<void> {
  return request<void>(`/api/cart/${encodeURIComponent(itemId)}`, {
    method: 'DELETE',
  });
}

export function register(input: RegisterInput): Promise<User> {
  return request<User>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function login(input: LoginInput): Promise<User> {
  return request<User>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function logout(): Promise<void> {
  return request<void>('/api/auth/logout', {
    method: 'POST',
  });
}

export function me(): Promise<User> {
  return request<User>('/api/auth/me');
}
