import type {
  AuthResponseDto,
  BlogPostDetailDto,
  FeedFilters,
  FeedResponseDto,
  RegisterInput,
} from '@virtual-mandi/shared';
import { mobileConfig } from '../config/env';
import { authStorage } from '../storage/auth-storage';
import { buildFeedQuery } from '../utils/feed';

export { buildFeedQuery };

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type ErrorPayload = { error?: { message?: string; code?: string } };

const parseResponse = async <T>(response: Response): Promise<T> => {
  const body = (await response.json().catch(() => ({}))) as T & ErrorPayload;
  if (!response.ok)
    throw new ApiError(body.error?.message ?? 'Request failed', response.status, body.error?.code);
  return body as T;
};

export class ApiClient {
  private accessToken?: string;
  private refreshInFlight?: Promise<boolean>;

  private async request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (this.accessToken) headers.set('Authorization', `Bearer ${this.accessToken}`);
    const response = await fetch(`${mobileConfig.apiBaseUrl}${path}`, { ...init, headers });
    if (response.status === 401 && retry && !path.includes('/auth/refresh')) {
      const refreshed = await this.refresh();
      if (refreshed) return this.request(path, init, false);
    }
    return parseResponse<T>(response);
  }

  async login(input: RegisterInput) {
    return this.saveAuth(
      await this.request<AuthResponseDto>('/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    );
  }

  async register(input: RegisterInput) {
    return this.saveAuth(
      await this.request<AuthResponseDto>('/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    );
  }

  private async saveAuth(response: AuthResponseDto) {
    this.accessToken = response.tokens.accessToken;
    await authStorage.saveRefreshToken(response.tokens.refreshToken);
    return response;
  }

  async refresh(): Promise<boolean> {
    if (this.refreshInFlight) return this.refreshInFlight;
    this.refreshInFlight = (async () => {
      const refreshToken = await authStorage.getRefreshToken();
      if (!refreshToken) return false;
      try {
        await this.saveAuth(
          await this.request<AuthResponseDto>(
            '/v1/auth/refresh',
            { method: 'POST', body: JSON.stringify({ refreshToken }) },
            false,
          ),
        );
        return true;
      } catch {
        this.accessToken = undefined;
        await authStorage.clearRefreshToken();
        return false;
      } finally {
        this.refreshInFlight = undefined;
      }
    })();
    return this.refreshInFlight;
  }

  async logout() {
    const refreshToken = await authStorage.getRefreshToken();
    if (refreshToken)
      await this.request(
        '/v1/auth/logout',
        { method: 'POST', body: JSON.stringify({ refreshToken }) },
        false,
      ).catch(() => undefined);
    this.accessToken = undefined;
    await authStorage.clearRefreshToken();
  }

  feed(filters: FeedFilters) {
    return this.request<FeedResponseDto<BlogPostDetailDto>>(
      `/v1/feed/posts?${buildFeedQuery(filters)}`,
    );
  }
}

export const apiClient = new ApiClient();
