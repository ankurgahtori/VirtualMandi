# Virtual Mandi API v1

Base path: `/v1`. JSON requests and responses use the error envelope:

```json
{
  "error": {
    "code": "MACHINE_CODE",
    "message": "Safe message",
    "requestId": "request-id",
    "fields": []
  }
}
```

Authenticated requests use `Authorization: Bearer <accessToken>`. Access tokens are short-lived; refresh tokens are opaque, rotated, hashed in PostgreSQL, and revoked on logout.

## Public endpoints

- `GET /health` — process health.
- `GET /ready` — PostgreSQL readiness.
- `GET /v1/feed/posts?locale=en-IN&locationId=&categoryId=&cursor=&limit=` — published, non-removed feed with locale fallback.
- `GET /v1/posts/:id?locale=en-IN` — published BlogPost detail.

## Authentication endpoints

- `POST /v1/auth/register` with `{ email, password }`.
- `POST /v1/auth/login` with `{ email, password }`.
- `POST /v1/auth/refresh` with `{ refreshToken }`; rotates the session.
- `POST /v1/auth/logout` with `{ refreshToken }` and a bearer access token.
- `GET /v1/me` with a bearer access token.

Authentication endpoints are rate limited per source IP.

## Admin endpoints

All require an access token for a user with `ADMIN` role.

- `POST /v1/admin/media/upload-url` with `{ objectKey, mimeType }` — issue a 15-minute S3/LocalStack presigned upload URL.
- `GET /v1/admin/posts?status=&type=&source=`
- `POST /v1/admin/posts` — create a BlogPost.
- `PATCH /v1/admin/posts/:id` — update translations, media, source, URL, categories, or locations.
- `POST /v1/admin/posts/:id/publish`
- `POST /v1/admin/posts/:id/archive`
- `POST /v1/admin/posts/:id/restore`
- `POST /v1/admin/posts/:id/remove` — soft removal.

Publishing requires a non-empty `en-IN` translation. Public detail and feed never expose draft, archived, or removed posts. Media uploads/downloads must use server-issued S3/LocalStack presigned URLs; AWS credentials are never returned to clients.
