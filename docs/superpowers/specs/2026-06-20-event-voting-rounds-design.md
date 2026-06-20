# Event-Based Voting Rounds — Design

**Date:** 2026-06-20
**Status:** Approved (design), pending implementation plan

## Problem

Posters are currently flat — no concept of a voting round. Once votes accumulate
on a poster, there is no clean way to start a fresh round: a device that voted on
poster "7" is blocked forever by `Voting @@unique([deviceId, posterId])`. Legacy
posters (ported from `ace_voting`) also lack fields, surfacing as data bugs.

We want a recurring **voting round** unit: open a round, collect votes, close it,
open the next round with fresh posters. Old data must be preserved, grouped under
its round.

## Goals

- Introduce an `Event` entity = one voting round / session.
- Exactly **one active event at a time**.
- A device may vote on the same `posterId` again in a *new* event.
- Migrate all existing (legacy) data into one closed "Legacy" event.
- Homepage shows the active event's posters only.

## Non-Goals

- Multiple simultaneously-active events (explicitly rejected — one at a time).
- Per-user (account) vote tracking — voting stays device-based.
- Reworking the device-lock / rate-limit mechanism beyond adding `eventId`.

## Data Model

New model:

```prisma
model Event {
  id        String      @id @default(auto()) @map("_id") @db.ObjectId
  name      String                          // e.g. "Round 1", "2026 Finals"
  status    EventStatus @default(active)    // active | closed
  createdAt DateTime    @default(now())
  closedAt  DateTime?
}

enum EventStatus {
  active
  closed
}
```

Add `eventId String @db.ObjectId` to: **Poster**, **Voting**, **VotingTally**,
**ResultArchive**.

Uniqueness changes (critical — enables re-voting across rounds):

```prisma
model Voting {
  // ...
  eventId String @db.ObjectId
  @@unique([deviceId, posterId, eventId])
}

model VotingTally {
  // ...
  eventId String @db.ObjectId
  @@unique([posterId, choice, eventId])
}
```

### Invariant: one active event

At most one `Event` with `status: active`. Enforced in application logic:
opening a new event closes the current active one in the same transaction.
(MongoDB partial unique indexes are not modeled in Prisma here; the invariant is
guaranteed by the open/close flow, not a DB constraint.)

## Behavior

### Homepage (`src/app/page.js`)
1. Find the active event (`status: active`).
2. If none → render "No active voting round." (no posters).
3. Else fetch `poster.findMany({ where: { eventId: active.id, status: "progressing" } })`
   plus that event's tallies, and render as today.

### Create poster (`POST /api/poster`)
- Resolve the active event. If none → `409` "No active event".
- Attach `eventId` = active event id to the new poster.

### Vote (`POST /api/voting`)
- Resolve the active event; write its `eventId` into the `Voting` row and the
  upserted `VotingTally` row.
- Device uniqueness now `(deviceId, posterId, eventId)` → same device can vote in
  the next round.
- Reject votes when no event is active (`409`).

### Admin event management
- New admin UI (under dashboard) to:
  - List events (name, status, created/closed dates, poster count).
  - **New Event** — closes the current active event (sets `status: closed`,
    `closedAt`), creates a new active event.
  - **Close Event** — closes active event; on close, archive per-poster results
    into `ResultArchive` (with `eventId`), consistent with the existing reset flow.
- All event mutations gated on `role === "Admin"` (consistent with current poster
  API guards) and call `revalidatePath("/")` + `revalidatePath("/dashboard")`.

## Legacy Migration

A backfill script (pattern of `scripts/backfill-status.mjs`, using raw
`$runCommandRaw` because legacy docs are missing fields and Prisma reads apply
defaults that hide the gap):

1. Create one `Event { name: "Legacy", status: "closed", closedAt: now }`.
2. Raw `$set` `eventId` = legacy event id on every `Poster`, `Voting`,
   `VotingTally`, `ResultArchive` document where `eventId` is missing.
3. Verify counts: every collection's docs now carry `eventId`.

Result: all old data sits in a closed "Legacy" event; the first real round starts
clean. The admin then creates the first active event for new voting.

## Risks / Notes

- **Missing-field trap:** existing `Voting`/`VotingTally`/`ResultArchive` docs
  have no `eventId`; Prisma queries filtering on `eventId` will match nothing
  until backfilled. Backfill via raw `$set`, mirroring the `status` fix already
  applied to `Poster`.
- **Ordering:** run schema change + `prisma generate` first, then backfill, then
  deploy code that filters on `eventId`. Filtering before backfill = empty
  homepage (the bug we just fixed).
- **No active event state** is a valid, expected state (between rounds) — UI must
  handle it gracefully on homepage, create-poster, and vote.

## Out of Scope for First Plan

- Bulk import/export of events.
- Public event history browsing for voters (only admin sees closed events).
