# Plan 07 — Mobile application v1

## Goal

Deliver the Inshorts-style farmer feed using the API and shared contracts.

## Scope

- Build self-registration and email/password sign-in with bearer-token handling and secure session persistence using platform-appropriate secure storage.
- Add navigation for auth and the protected feed.
- Organize static mobile strings into locale files such as `en.json` and `hi.json`, with common and page-specific namespaces.
- Implement a vertically paged story feed with loading, pull-to-refresh, empty, offline, and error states.
- Add language, location, and category filter selection, retaining the selected filters across feed requests.
- Render localized text stories with readable typography, accessible controls, and English fallback when a translation is unavailable.
- Render text-with-music stories with play/pause, progress, mute, and cleanup when changing stories.
- Render video stories with basic playback controls, loading state, and failure fallback.
- Add prefetching/caching only where it improves the current feed without introducing complex recommendations.
- Handle token refresh and forced sign-out safely.
- Add analytics/logging hooks behind an interface, without collecting sensitive farmer data by default.
- Add component and screen tests for auth state, feed pagination, lifecycle filtering assumptions, and media cleanup.

## Constraints

- Clients consume API DTOs and shared validation/types, never Prisma models directly.
- Do not expose admin/editor operations in the mobile app.
- Respect accessibility, low bandwidth, and small-screen behavior.

## Validation

- iOS and Android launch checks.
- Unit/component tests.
- Manual checks for text, music, and video stories, including rapid swipes and interrupted playback.
- API integration against a seeded development environment.

## Definition of done

- An authenticated farmer can consume all three supported content forms in a stable vertical feed.
- Session expiration, network failure, and empty feed states are handled visibly.
