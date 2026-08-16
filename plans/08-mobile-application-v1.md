# Plan 08 — Mobile application v1

## Objective

Build the farmer-facing mobile client for the first published BlogPost vertical slice, then add the remaining media types without breaking the feed contract.

## Implementation order

1. Auth screens: register, login, logout, expired-session state.
2. API client with bearer access token, refresh, retry-once behavior, and forced sign-out.
3. Protected navigation and feed query state.
4. Vertical paged BlogPost card with title, image, content, createdAt, source, and external URL action.
5. Locale selection and namespaced static translations (`en.json`, `hi.json`).
6. Language/location/category filter UI and persisted filter state.
7. Loading, empty, offline, retry, and error states.
8. Music/video renderers only after BlogPost text flow is stable.

## Technical rules

- Use shared DTOs/schemas, never Prisma types.
- Use secure device storage for refresh/session material; avoid plain async storage for secrets.
- Do not render untrusted HTML without sanitization or a safe renderer.
- Open external URLs through the platform-safe linking API and validate the API-provided URL.
- Stop/release audio/video resources when a card loses focus or unmounts.
- Keep feed ordering/cursor handling deterministic and prevent duplicate cards.
- Design for low bandwidth: image placeholders, retry, bounded prefetch, and no automatic large downloads.

## Screens

- `Auth/Register`
- `Auth/Login`
- `Feed/Home`
- `Feed/Filters`
- `Post/Detail` or expanded card
- `Settings/Language`

## Tests

Mock the API and test auth transitions, fallback locale, feed pagination, filter serialization, external-link handling, rapid swipe media cleanup, loading/error/empty states, and accessibility labels.

## Completion criteria

- A user can self-register, log in, see seeded/published BlogPosts, filter them, and open a redirect URL on iOS and Android.
- Session expiry and network failures are visible and recoverable.
- Music/video support is isolated behind post-type/media components and does not affect BlogPost rendering.
