# Project Status & Done Workflow — Design

Date: 2026-06-19

## Goal

Add a lifecycle status to projects (posters) so the homepage only shows live
projects, and the dashboard can retire projects — individually or all at once —
in one click. Retiring a project closes its voting.

## Status model

Binary status, reversible:

- `progressing` — default on creation; shown on homepage; accepts votes.
- `done` — hidden from homepage; voting blocked; still visible in dashboard.

A `done` project can be toggled back to `progressing` (reappears, voting reopens).

## Data model (`prisma/schema.prisma`)

```prisma
enum Status {
  progressing
  done
}

model Poster {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  userId    String
  posterId  String
  status    Status   @default(progressing)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Migration

Existing `Poster` documents have no `status` field. Prisma errors when reading a
document missing a required field, so existing rows must be backfilled before the
field goes live.

- `scripts/backfill-status.mjs` — set `status: "progressing"` on every Poster doc
  that lacks one (use the Mongo driver / `updateMany` with `{ status: { $exists: false } }`,
  or set unconditionally — all existing projects are live).
- Then `npx prisma db push --schema <abs path>` and `npx prisma generate`.
- Both DB-touching steps are run by the user (sandbox blocks live-DB writes).

## Homepage (`src/app/page.js`)

Change `prisma.poster.findMany({})` to:

```js
prisma.poster.findMany({ where: { status: "progressing" } });
```

Done projects disappear. The "Total Posters" stat reflects only progressing
projects — acceptable, the homepage is the public live view.

## Vote API (`src/app/api/voting/route.js`)

Before inserting a vote, look up the poster by `posterId`:

```js
const poster = await prisma.poster.findFirst({ where: { posterId } });
if (!poster || poster.status === "done") {
  return NextResponse.json(
    { message: "Voting is closed for this project." },
    { status: 403 }
  );
}
```

Placed after input validation, before the `voting.create`. Reuses existing
rate-limit and device-dedup logic unchanged.

## Poster page (`src/app/poster/[id]/page.jsx` + `Poster.jsx`)

- `page.jsx` (server): fetch the poster, pass `status` (or a `closed` boolean) to
  the client component.
- `Poster.jsx`: when closed, render a "Voting closed for this project" message and
  hide the radio inputs + submit button.

## Status API — `PATCH /api/poster` (`src/app/api/poster/route.js`)

New handler, session-guarded (same `auth()` pattern as POST/DELETE):

- `{ id, status }` where status ∈ {progressing, done} → update one project.
  - Validate `status` against the allowed set; reject otherwise (400).
- `{ action: "markAllDone" }` → `prisma.poster.updateMany({ where: { status: "progressing" }, data: { status: "done" } })`.
- Unauthorized → 401. Returns 200 on success.

## Dashboard (`src/app/(Dashbaord)/dashboard/Dashboard.jsx`)

- **Status source:** use the real `poster.status` (drop the `|| "active"` fallback).
  The `posterMap` for vote-only rows with no DB record keeps a sensible default;
  those rows have no `dbId` so status actions are disabled for them (consistent
  with existing delete-disabled behavior).
- **Status badge:** `progressing` → default/blue badge, `done` → secondary/grey.
- **Filter dropdown:** replace `all / active / inactive` with `all / progressing / done`.
- **Per-row action:** a toggle button — **Mark Done** when progressing,
  **Reopen** when done — `PATCH { id: dbId, status: <next> }`, then refresh.
  Disabled when `!dbId`.
- **Header action:** **Mark All Done** button next to "Create New Poster", wrapped
  in an `AlertDialog` confirm ("End the round? All progressing projects become
  done and leave the homepage."). On confirm → `PATCH { action: "markAllDone" }`,
  then refresh.

## Out of scope (YAGNI)

- More than two states; per-status timestamps; audit log of who toggled.
- Soft-undo of "Mark All Done" beyond the existing per-project Reopen toggle.
- Homepage display of done projects in any form.

## Testing / verification

- Turbopack build passes (webpack build EPERM is a known Windows-local issue).
- Manual: create project (progressing, shows on homepage) → vote works → Mark Done
  (gone from homepage, vote via direct link returns 403, dashboard shows `done`)
  → Reopen (back on homepage, voting works) → Mark All Done (homepage empty).
