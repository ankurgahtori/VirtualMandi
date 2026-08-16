# Environment inventory

Never commit `.env` files, credentials, dumps, signing files, or production data. Public client variables are bundled into the browser/mobile applications.

| Variable                                      | Owner           | Exposure           | Local development                                     |
| --------------------------------------------- | --------------- | ------------------ | ----------------------------------------------------- |
| `DATABASE_URL`                                | API/database    | Server-only secret | PostgreSQL Docker URL                                 |
| `JWT_SECRET`                                  | API operator    | Server-only secret | Development fallback only; required in production     |
| `ACCESS_TOKEN_TTL_SECONDS`                    | API operator    | Server-only config | `900`                                                 |
| `REFRESH_TOKEN_TTL_SECONDS`                   | API operator    | Server-only config | `2592000`                                             |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | API operator    | Server-only secret | LocalStack `test` values                              |
| `AWS_REGION`                                  | API operator    | Server config      | `ap-south-1`                                          |
| `S3_BUCKET` / `S3_ENDPOINT`                   | API operator    | Server config      | `virtual-mandi-local` / `http://localhost:4566`       |
| `CORS_ORIGINS`                                | API operator    | Server config      | `http://localhost:5173`                               |
| `VITE_API_BASE_URL`                           | Admin frontend  | Public/bundled     | `http://localhost:3000`                               |
| `EXPO_PUBLIC_API_BASE_URL`                    | Mobile frontend | Public/bundled     | Platform-specific URL in `apps/mobile/ENVIRONMENT.md` |
| `EXPO_PUBLIC_DEFAULT_LOCALE`                  | Mobile frontend | Public/bundled     | `en-IN`                                               |

Staging and production must use separate PostgreSQL databases, S3 buckets, JWT secrets, and allowed origins. LocalStack credentials must never be reused against AWS.
