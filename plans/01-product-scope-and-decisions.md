# Plan 01 — Product scope and decisions

## Goal

Turn the Virtual Mandi idea into an implementation-ready v1 contract before code is generated.

## V1 user journeys

### Farmer/mobile user

- Sign in with email and password.
- Receive a daily, vertically swiped feed of agricultural stories.
- Read text stories.
- Play text stories with background music.
- Watch video stories with basic play/pause and progress controls.
- Move between stories without losing the current feed position.

### Admin/editor

- Sign in with email and password.
- Create and edit content.
- Upload or register media through a defined media-storage boundary.
- Publish content for the feed.
- Archive content so it is no longer in the active feed but remains recoverable.
- Remove content using a reversible soft-delete in v1.
- View content by lifecycle state.

## Explicit non-goals for v1

- Social login, phone OTP, and multi-factor authentication.
- Comments, likes, follows, notifications, recommendations, search, and personalization.
- Native media transcoding pipeline.
- Payments or marketplace transactions.
- Multi-tenant organizations and granular editorial roles.

## Confirmed v1 decisions

- Daily-content timezone is `Asia/Kolkata` (IST).
- Mobile users self-register with email and password.
- Development and tests use LocalStack S3 in Docker; deployed environments use AWS S3.
- Content is multilingual. Each story may have multiple translations, with English as the required fallback.
- The mobile feed is filtered by language, location, and category.
- Authentication uses bearer access tokens with API-managed refresh/revocation behavior.
- The admin website is English in v1, while mobile static strings are organized by locale and namespace, for example `en.json` and `hi.json` with common/page sections.
- Development seed data is created through ordered, repeatable seed modules to preserve foreign-key dependencies.

## Remaining implementation-level choices

- The initial supported mobile locales and the exact location hierarchy still need to be selected during the shared-contracts plan.
- The API token expiry and refresh-token storage details should be finalized in the backend security design.
- LocalStack Docker image/version and the initial supported mobile locales can be finalized during implementation; the media-storage interface must remain stable.
- `Post`/`BlogPost` schema details are defined in Plans 03–05; future post types must not break the top-level Post contract.

Keep these implementation details behind configuration or interfaces so they can change without altering client contracts.

## Definition of done

- The unresolved decisions above are answered or recorded as accepted defaults.
- Content states and ownership rules are agreed.
- The API and client plans can proceed without inventing product behavior.
