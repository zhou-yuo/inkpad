# Inkpad Project Guide

This file is for future AI/dev sessions. Read it before making product, UI, auth, database, or encryption changes.

## Product

Inkpad is a private memo app for Cloudflare Pages, inspired by Apple Notes on macOS/iOS.

Core experience:

- Account/password login and registration.
- First registered account becomes admin.
- Notes UI uses a split list/editor layout on desktop.
- Mobile uses a list-first flow with a Notes button to return to the list.
- Admin can view users and encrypted note metadata.
- Users can change their own password.
- Admin can reset a user's login password.

## Stack

- Nuxt 3 + Vue 3
- Nitro preset: `cloudflare_pages`
- Cloudflare D1 for storage
- Wrangler for local preview and migrations
- Web Crypto API for password hashing and client-side note encryption

Important commands:

```bash
npm run build
npm run db:migrate:local
npm run db:migrate:remote
npm run preview
```

The production output directory is `dist`.

## Data Model

Main tables:

- `users`: account identity, password hash/salt, encryption salt, role.
- `sessions`: httpOnly login sessions.
- `notes`: encrypted title/body plus IVs and metadata.

Account naming:

- User-facing identity is `account`, not `username` and not email.
- `username` still exists only for compatibility with older migrations/data.
- New UI/API work should use `account`.

Admin:

- Role is `admin` or `user`.
- First registered account is automatically `admin`.
- Local development account is usually `zhouyu`, role `admin`.

## Privacy And Encryption

Notes are encrypted in the browser before being sent to the server.

- Server stores encrypted note title/body and IVs.
- Admin cannot read note plaintext from the admin page.
- Notes are encrypted with a random per-user `vaultKey`.
- The account password derives a wrapping key that encrypts/decrypts `vaultKey`.
- Changing password re-wraps `vaultKey`; it must not rewrite notes or change note timestamps.
- Older data that was encrypted directly with the password-derived key is migrated on first successful unlock.
- The active `vaultKey` is kept only in memory.
- Refreshing the page clears the key and shows `Vault Locked`.
- After 10 minutes of inactivity, the vault locks automatically.

Password changes:

- Self-service password change should only re-wrap `vaultKey` with the new password.
- Admin password reset only changes login credentials. It cannot reveal plaintext and does not re-wrap `vaultKey`.
- If admin reset is used, the user may still need their previous vault password to unlock existing notes, then perform a self-service password change to re-wrap the vault.
- Be careful when changing password or encryption logic: preserving access to existing notes and timestamps matters more than convenience.

## UI Direction

Style target: iOS/macOS 26-ish, clean and soft, but still practical.

Current visual language:

- Frosted glass panels using backdrop blur.
- Soft light background with subtle radial color washes.
- Compact Apple Notes-like split view.
- Rounded but not cartoonish controls.
- Account chip with initials avatar in the sidebar.
- Admin is an operational table view, not a marketing page.

Design rules for future changes:

- Keep the first screen the actual app, not a landing page.
- Keep controls compact and usable.
- Do not add decorative blobs/orbs beyond the existing subtle background treatment.
- Keep mobile layout free of overlap; text must fit.
- Links styled as buttons should use flex centering.
- Use `account` wording in user-facing copy.

## Important Files

- `pages/index.vue`: main notes app, login/register, vault lock, user password change.
- `pages/admin.vue`: admin users/notes metadata, admin password reset.
- `composables/useVaultCrypto.ts`: browser-side encryption and vault lock state.
- `composables/useSession.ts`: auth/session helpers.
- `composables/useNotes.ts`: encrypted notes load/save helpers.
- `server/utils/auth.ts`: password hashing, sessions, user helpers.
- `server/api/auth/*`: login/register/session/password APIs.
- `server/api/notes/*`: encrypted note CRUD.
- `server/api/admin/*`: admin users/notes/password APIs.
- `migrations/*.sql`: D1 schema migrations.
- `assets/css/main.css`: all current styling.

## Development Notes

- Prefer small, direct changes over new abstractions.
- Use D1 migrations for schema changes.
- Keep Cloudflare compatibility in mind: prefer Web APIs over Node-only APIs in server code.
- Do not store plaintext note content on the server.
- Do not add email collection unless explicitly requested.
- After significant changes, run `npm run build`.
- For D1-affecting changes, run local migrations and smoke test through `npm run preview`.

## Current Known Behavior

- Refreshing while logged in shows `Vault Locked`.
- Unlock requires the account password.
- Admin button appears only for users with role `admin`.
- Local test accounts should not be kept; clean them after smoke tests.
