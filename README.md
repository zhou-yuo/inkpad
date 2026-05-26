# Inkpad

A Cloudflare Pages memo app inspired by Apple Notes, built with Nuxt 3, D1, and browser-side AES-GCM encryption.

For future AI/dev sessions, read `PROJECT_GUIDE.md` first. It captures product direction, UI style, privacy rules, and development conventions.

## Features

- Account/password registration and login
- First registered account becomes admin
- Desktop split view and mobile notes workflow
- Client-side note title/body encryption before syncing
- Admin page for users and encrypted-note metadata
- Cloudflare Pages + D1 deployment target

## Local Setup

```bash
npm install
npm run db:migrate:local
npm run build
npm run preview
```

For ordinary Nuxt UI work you can run `npm run dev`, but API routes require the Cloudflare D1 binding, so full-stack testing is best through Wrangler Pages dev.

## Cloudflare Setup

1. Create a D1 database named `inkpad`.
2. Replace `database_id` in `wrangler.toml`.
3. Apply migrations:

```bash
npm run db:migrate:remote
```

4. Create a Cloudflare Pages project.
5. Use build command:

```bash
npm run build
```

6. Use build output directory:

```bash
dist
```

7. Bind D1 to the Pages project with binding name `DB`.

## Privacy Model

The server stores only encrypted note title/body plus metadata. The encryption key is derived in the browser from the user's password and per-user salt. Refreshing the browser keeps the login cookie but clears the in-memory encryption key, so the vault asks for the password again before notes can be decrypted.

This is practical privacy for a small app, not a substitute for a formal security audit.
