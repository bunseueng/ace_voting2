# SignIn Loading, Admin Banner, Homepage Search/Sort, Vote Reset — Design

Date: 2026-06-19
Repo: D:\NextJS\ace_voting2

Four independent features bundled into one spec. Each is small and ships independently.

## Feature 1 — SignIn loading state

`src/app/sign_in/SignIn.jsx` currently calls `signIn("credentials", { redirect: true })`
and shows errors via `alert`. Change to:

- `signIn(..., { redirect: false })` so the result is inspectable.
- `loading` state: submit button shows a spinner + is disabled while the request runs.
- On success (`!res?.error`): `router.push(callbackUrl)` (default `/`).
- On error: set an inline error message + `toast.error`; clear loading.

No new deps (uses existing `sonner` toast + `lucide-react` Loader + `next/navigation`).

## Feature 2 — Admin-configurable banner (Cloudinary)

Replace the hardcoded `/banner.jfif` with an admin-set image stored in Cloudinary,
its URL persisted in the DB.

### Data model

```prisma
model Setting {
  id    String @id @default(auto()) @map("_id") @db.ObjectId
  key   String @unique
  value String
}
```

Banner lives under `key: "banner"`, `value: <cloudinary secure_url>`.

### Upload flow

- New dependency: `cloudinary` (pinned exact version).
- Env (admin provides): `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
- `POST /api/banner` (session-guarded via `auth()`): accepts a multipart form file,
  uploads to Cloudinary (folder `ace_voting`), upserts `Setting` key `banner` with the
  returned `secure_url`, returns the URL.
- If Cloudinary env is missing, return 500 with a clear message (don't crash the app).

### Display

- A server helper `getBanner()` reads `Setting` `banner`; returns its value or the
  fallback `"/banner.jfif"`.
- `src/app/page.js` (homepage, server) fetches the banner and passes it to `Header`.
  `Header.jsx` takes a `src` prop.
- Poster page (`src/app/poster/[id]/page.jsx`, server) fetches the banner and passes
  it to `Poster` as a `banner` prop; `Poster.jsx` uses it instead of the hardcoded path.
- Dashboard gets a **Banner** card (in `Dashboard.jsx` or a small child component):
  file input + upload button → `POST /api/banner` → toast + reload. Shows current banner.

## Feature 3 — Homepage search + sort

`src/app/page.js` currently maps all progressing posters server-side. Extract the grid
into a client component `PosterGrid` that receives `posters` and `tallies` as props and
provides:

- A search input filtering by `posterId` (case-insensitive substring).
- A sort dropdown: **Most Votes** (default, by tally `number` desc), Newest (`createdAt`
  desc), Oldest (`createdAt` asc).
- The existing card markup (vote count, progress bar, Vote button) moves into this
  component unchanged.

The homepage stays a server component that queries `where: { status: "progressing" }`
and renders `<PosterGrid posters tallies />`. The "Voting Summary" stats block stays in
`page.js`.

## Feature 4 — Vote reset (archive → fresh round)

### Data model

```prisma
model ResultArchive {
  id         String   @id @default(auto()) @map("_id") @db.ObjectId
  posterId   String
  yesVotes   Int      @default(0)
  noVotes    Int      @default(0)
  archivedAt DateTime @default(now())
}
```

### Reset action

Extend `PATCH /api/poster` with `{ action: "reset", posterId }` (session-guarded):

1. Read the poster's two `VotingTally` rows (Yes / No) → derive `yesVotes`, `noVotes`.
2. In a `prisma.$transaction`:
   - `resultArchive.create` with the snapshot.
   - `votingTally.deleteMany({ where: { posterId } })` (zeros counts).
   - `voting.deleteMany({ where: { posterId } })` (clears device-dedup → re-vote allowed).

Result: counts reset to 0, the snapshot is preserved, and every device may vote again.

### Dashboard UI

- Per-row **Reset** button (in the Actions cell, alongside Mark Done / Reopen / Delete),
  wrapped in an `AlertDialog` confirm ("Archive current result and reset votes to zero?
  Everyone can vote again."). On confirm → `PATCH { action: "reset", posterId }` → reload.
  Disabled when `!dbId`.

### History view

- New page `src/app/(Dashbaord)/dashboard/history/page.jsx` (server, session-guarded,
  `force-dynamic`): reads `resultArchive.findMany({ orderBy: { archivedAt: "desc" } })`
  and renders a read-only table (Poster ID, Yes, No, Total, Archived date).
- Dashboard header gets a link/button to `/dashboard/history`.

## Migration

- `prisma db push` to register `Setting` + `ResultArchive` (new collections; no backfill
  needed — empty until used). Run by the user (sandbox-gated). Shared DB with ace_voting,
  but these collections are new so a push from v2 is required.
- `npx prisma generate` after schema change.

## Out of scope (YAGNI)

- Multiple banners / per-page banners; image cropping in-app.
- Per-round labels or notes on archives; editing/deleting archives.
- Pagination on history (small data).
- Server-side search/sort (client-side is enough for this list size).

## Verification

- `pnpm exec next build --turbopack` passes.
- Manual: sign in shows spinner; upload banner → appears on homepage + poster page;
  homepage search filters and sort reorders; reset archives + zeros + re-vote works;
  history page lists archives.
