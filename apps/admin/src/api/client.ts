import type {
  AuthResponseDto,
  BlogPostCreateInput,
  BlogPostDetailDto,
  BlogPostUpdateInput,
} from '@virtual-mandi/shared';

const baseUrl =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ||
  'http://localhost:3000';
const REFRESH_KEY = 'virtual-mandi.admin.refresh-token';

export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

const read = async <T>(response: Response): Promise<T> => {
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: { message?: string; code?: string };
  };
  if (!response.ok)
    throw new AdminApiError(
      body.error?.message ?? 'Request failed',
      response.status,
      body.error?.code,
    );
  return body as T;
};

export type AdminPost = BlogPostDetailDto;
export class AdminApi {
  private accessToken?: string;
  private async request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (this.accessToken) headers.set('Authorization', `Bearer ${this.accessToken}`);
    const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
    if (response.status === 401 && retry && !path.includes('/auth/')) {
      if (await this.refresh()) return this.request(path, init, false);
    }
    return read<T>(response);
  }

  private saveAuth(response: AuthResponseDto) {
    this.accessToken = response.tokens.accessToken;
    sessionStorage.setItem(REFRESH_KEY, response.tokens.refreshToken);
    return response;
  }

  login(email: string, password: string) {
    return this.request<AuthResponseDto>('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }).then((response) => this.saveAuth(response));
  }

  async refresh() {
    const refreshToken = sessionStorage.getItem(REFRESH_KEY);
    if (!refreshToken) return false;
    try {
      this.saveAuth(
        await this.request<AuthResponseDto>(
          '/v1/auth/refresh',
          { method: 'POST', body: JSON.stringify({ refreshToken }) },
          false,
        ),
      );
      return true;
    } catch {
      this.accessToken = undefined;
      sessionStorage.removeItem(REFRESH_KEY);
      return false;
    }
  }

  async logout() {
    const refreshToken = sessionStorage.getItem(REFRESH_KEY);
    if (refreshToken)
      await this.request(
        '/v1/auth/logout',
        { method: 'POST', body: JSON.stringify({ refreshToken }) },
        false,
      ).catch(() => undefined);
    this.accessToken = undefined;
    sessionStorage.removeItem(REFRESH_KEY);
  }

  listPosts(filters: { status?: string; source?: string; type?: string } = {}) {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value && query.set(key, value));
    return this.request<{ items: AdminPost[] }>(`/v1/admin/posts?${query.toString()}`);
  }

  createPost(input: BlogPostCreateInput) {
    return this.request<AdminPost>('/v1/admin/posts', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }
  updatePost(id: string, input: BlogPostUpdateInput) {
    return this.request<AdminPost>(`/v1/admin/posts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }
  transition(id: string, action: 'publish' | 'archive' | 'restore' | 'remove') {
    return this.request<unknown>(`/v1/admin/posts/${id}/${action}`, { method: 'POST' });
  }
}

export const adminApi = new AdminApi();
