# Event-Based Voting Rounds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce an `Event` (voting round) entity so admins can run repeated voting rounds, with all legacy data migrated into one closed "Legacy" event.

**Architecture:** Add a Prisma `Event` model and an `eventId` foreign key on Poster/Voting/VotingTally/ResultArchive. Exactly one event is `active` at a time, enforced by the open/close flow. Homepage, poster-create, and voting all resolve the active event via a shared helper. Legacy documents are backfilled into a closed event with a raw MongoDB `$set` (Prisma reads hide missing fields behind defaults).

**Tech Stack:** Next.js 15 (App Router), Prisma 6 + MongoDB, NextAuth v5 (credentials), bcryptjs.

## Global Constraints

- Prisma client output: `src/generated/prisma` (import via `@/generated/prisma`). Run `npx prisma generate` after every schema change.
- All admin mutations gated on `session?.user?.role === "Admin"` (matches `src/app/api/poster/route.js`).
- Every poster/event/vote mutation calls `revalidatePath("/")` and `revalidatePath("/dashboard")`.
- MongoDB ObjectId FKs use `String @db.ObjectId`.
- Legacy docs missing a field must be backfilled via `$runCommandRaw` / `$set`, never a Prisma `update` (Prisma read-defaults mask the missing field — see `scripts/backfill-status.mjs`).
- No automated test framework exists; each task's "test" is a runnable node script or `curl` against `pnpm dev` (http://localhost:3000) with expected output stated.
- One active event invariant: opening a new event closes the current active one in the same `$transaction`.

---

### Task 1: Add Event model + eventId fields to schema

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `Event { id, name, status: EventStatus, createdAt, closedAt }`; enum `EventStatus { active, closed }`; `eventId String @db.ObjectId` on `Poster`, `Voting`, `VotingTally`, `ResultArchive`; uniqueness `Voting @@unique([deviceId, posterId, eventId])`, `VotingTally @@unique([posterId, choice, eventId])`.

- [ ] **Step 1: Edit schema** — add the `Event` model and `EventStatus` enum, and `eventId` to the four models. Replace the existing `Poster`, `Voting`, `VotingTally`, `ResultArchive` blocks:

```prisma
model Poster {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  userId    String
  posterId  String
  eventId   String   @db.ObjectId
  status    Status   @default(progressing)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Voting {
  id        String     @id @default(auto()) @map("_id") @db.ObjectId
  posterId  String
  eventId   String     @db.ObjectId
  choice    VoteChoice
  deviceId  String
  createdAt DateTime   @default(now())

  @@unique([deviceId, posterId, eventId])
}

model VotingTally {
  id       String     @id @default(auto()) @map("_id") @db.ObjectId
  posterId String
  eventId  String     @db.ObjectId
  choice   VoteChoice
  number   Int        @default(0)

  @@unique([posterId, choice, eventId])
}

model ResultArchive {
  id         String   @id @default(auto()) @map("_id") @db.ObjectId
  posterId   String
  eventId    String   @db.ObjectId
  yesVotes   Int      @default(0)
  noVotes    Int      @default(0)
  archivedAt DateTime @default(now())
}

model Event {
  id        String      @id @default(auto()) @map("_id") @db.ObjectId
  name      String
  status    EventStatus @default(active)
  createdAt DateTime    @default(now())
  closedAt  DateTime?
}

enum EventStatus {
  active
  closed
}
```

- [ ] **Step 2: Regenerate client**

Run: `npx prisma generate`
Expected: `✔ Generated Prisma Client ... to .\src\generated\prisma`

- [ ] **Step 3: Verify new types exist**

Run:
```bash
node -e "import('./src/generated/prisma/index.js').then(m=>{const p=new m.PrismaClient();console.log('event model:', typeof p.event.findMany==='function');p.\$disconnect();})"
```
Expected: `event model: true`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add Event model and eventId fields"
```

---

### Task 2: Legacy data migration script

**Files:**
- Create: `scripts/migrate-legacy-event.mjs`

**Interfaces:**
- Consumes: `Event` model from Task 1.
- Produces: one closed `Event` named "Legacy"; every existing Poster/Voting/VotingTally/ResultArchive doc gets `eventId` = that event's id.

- [ ] **Step 1: Write the migration script**

```javascript
// Backfill all legacy data into one closed "Legacy" event.
// Run once: node scripts/migrate-legacy-event.mjs
import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
  // Reuse existing Legacy event if the script is re-run.
  let legacy = await prisma.event.findFirst({ where: { name: "Legacy" } });
  if (!legacy) {
    legacy = await prisma.event.create({
      data: { name: "Legacy", status: "closed", closedAt: new Date() },
    });
  }
  const id = { $oid: legacy.id };

  for (const coll of ["Poster", "Voting", "VotingTally", "ResultArchive"]) {
    const res = await prisma.$runCommandRaw({
      update: coll,
      updates: [
        {
          q: { eventId: { $exists: false } },
          u: { $set: { eventId: id } },
          multi: true,
        },
      ],
    });
    console.log(`${coll}:`, JSON.stringify(res));
  }
  console.log("Legacy event id:", legacy.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

> Note: `eventId` is stored as a BSON ObjectId (`{ $oid }`) so Prisma's `@db.ObjectId` reads it correctly.

- [ ] **Step 2: Run the migration**

Run: `node scripts/migrate-legacy-event.mjs`
Expected: each line shows `"nModified": <count>`, and a `Legacy event id: <24-hex>`.

- [ ] **Step 3: Verify posters now resolve by eventId**

Run:
```bash
node -e "import('./src/generated/prisma/index.js').then(async m=>{const p=new m.PrismaClient();const e=await p.event.findFirst({where:{name:'Legacy'}});console.log('posters in legacy:', await p.poster.count({where:{eventId:e.id}}));await p.\$disconnect();})"
```
Expected: `posters in legacy: 82`

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-legacy-event.mjs
git commit -m "feat: legacy data migration into closed Legacy event"
```

---

### Task 3: Active-event helper

**Files:**
- Create: `src/lib/activeEvent.js`

**Interfaces:**
- Consumes: `@/lib/prisma`.
- Produces: `getActiveEvent(): Promise<Event|null>` — returns the single event with `status: "active"`, or `null`.

- [ ] **Step 1: Write the helper**

```javascript
import prisma from "@/lib/prisma";

// The single active voting round, or null when between rounds.
export async function getActiveEvent() {
  return prisma.event.findFirst({ where: { status: "active" } });
}
```

- [ ] **Step 2: Verify it loads and returns null (no active event yet)**

Run:
```bash
node -e "import('./src/generated/prisma/index.js').then(async m=>{const p=new m.PrismaClient();console.log('active:', await p.event.findFirst({where:{status:'active'}}));await p.\$disconnect();})"
```
Expected: `active: null` (only the closed Legacy event exists so far).

- [ ] **Step 3: Commit**

```bash
git add src/lib/activeEvent.js
git commit -m "feat: getActiveEvent helper"
```

---

### Task 4: Event management API (open/close)

**Files:**
- Create: `src/app/api/event/route.js`

**Interfaces:**
- Consumes: `@/lib/prisma`, `@/auth`, `getActiveEvent` from Task 3.
- Produces: `GET` → list events (newest first); `POST {name}` → close current active + create new active (transaction); `PATCH {action:"close"}` → close active event and archive its tallies into `ResultArchive`.

- [ ] **Step 1: Write the route**

```javascript
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getActiveEvent } from "@/lib/activeEvent";

async function requireAdmin() {
  const session = await auth();
  return session?.user?.role === "Admin";
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const events = await prisma.event.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ events }, { status: 200 });
}

export async function POST(request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { name } = await request.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ message: "Invalid name" }, { status: 400 });
  }
  const active = await getActiveEvent();
  const ops = [];
  if (active) {
    ops.push(
      prisma.event.update({
        where: { id: active.id },
        data: { status: "closed", closedAt: new Date() },
      })
    );
  }
  ops.push(
    prisma.event.create({ data: { name: name.trim(), status: "active" } })
  );
  const result = await prisma.$transaction(ops);
  const created = result[result.length - 1];

  revalidatePath("/");
  revalidatePath("/dashboard");
  return NextResponse.json({ message: "Event opened", event: created }, { status: 201 });
}

export async function PATCH(request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  if (body.action !== "close") {
    return NextResponse.json({ message: "Invalid action" }, { status: 400 });
  }
  const active = await getActiveEvent();
  if (!active) {
    return NextResponse.json({ message: "No active event" }, { status: 409 });
  }

  // Archive per-poster results for the closing event.
  const tallies = await prisma.votingTally.findMany({ where: { eventId: active.id } });
  const byPoster = {};
  for (const t of tallies) {
    byPoster[t.posterId] ??= { yesVotes: 0, noVotes: 0 };
    if (t.choice === "Yes") byPoster[t.posterId].yesVotes = t.number;
    if (t.choice === "No") byPoster[t.posterId].noVotes = t.number;
  }
  const archives = Object.entries(byPoster).map(([posterId, v]) =>
    prisma.resultArchive.create({
      data: { posterId, eventId: active.id, yesVotes: v.yesVotes, noVotes: v.noVotes },
    })
  );

  await prisma.$transaction([
    ...archives,
    prisma.event.update({
      where: { id: active.id },
      data: { status: "closed", closedAt: new Date() },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/dashboard");
  return NextResponse.json({ message: "Event closed" }, { status: 200 });
}
```

- [ ] **Step 2: Start dev server (if not running)**

Run: `pnpm dev` (background) — wait for `Ready`.

- [ ] **Step 3: Verify unauthorized GET is blocked**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/event`
Expected: `401`

- [ ] **Step 4: Verify an event can be opened (authenticated)**

Use an authenticated session cookie (login as `admin` via browser, copy the `authjs.session-token` cookie, or reuse the curl-login flow). Then:
```bash
curl -s -b cookies.txt -X POST http://localhost:3000/api/event \
  -H "Content-Type: application/json" -d '{"name":"Round 1"}'
```
Expected: JSON `{"message":"Event opened","event":{...,"status":"active"}}`

- [ ] **Step 5: Verify exactly one active event**

Run:
```bash
node -e "import('./src/generated/prisma/index.js').then(async m=>{const p=new m.PrismaClient();console.log('active count:', await p.event.count({where:{status:'active'}}));await p.\$disconnect();})"
```
Expected: `active count: 1`

- [ ] **Step 6: Commit**

```bash
git add src/app/api/event/route.js
git commit -m "feat: event open/close API"
```

---

### Task 5: Poster create attaches active eventId

**Files:**
- Modify: `src/app/api/poster/route.js` (POST handler)

**Interfaces:**
- Consumes: `getActiveEvent` from Task 3.
- Produces: new posters carry the active event's `eventId`; create blocked (409) when no active event.

- [ ] **Step 1: Add the import**

At the top of `src/app/api/poster/route.js`, add:
```javascript
import { getActiveEvent } from "@/lib/activeEvent";
```

- [ ] **Step 2: Update the POST handler** — replace the create block:

```javascript
    const active = await getActiveEvent();
    if (!active) {
      return NextResponse.json(
        { message: "No active event. Open an event first." },
        { status: 409 }
      );
    }

    await prisma.poster.create({
      data: {
        userId: session.user.id,
        posterId,
        eventId: active.id,
      },
    });

    revalidatePath("/");
    revalidatePath("/dashboard");
```

- [ ] **Step 3: Verify create attaches eventId**

With an active event open (Task 4) and authenticated cookie:
```bash
curl -s -b cookies.txt -X POST http://localhost:3000/api/poster \
  -H "Content-Type: application/json" -d '{"posterId":"E1-1"}'
```
Expected: `{"message":"Poster successfully created"}` (201). Then:
```bash
node -e "import('./src/generated/prisma/index.js').then(async m=>{const p=new m.PrismaClient();const e=await p.event.findFirst({where:{status:'active'}});console.log('new poster in active:', await p.poster.count({where:{eventId:e.id,posterId:'E1-1'}}));await p.\$disconnect();})"
```
Expected: `new poster in active: 1`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/poster/route.js
git commit -m "feat: posters attach to active event"
```

---

### Task 6: Voting writes eventId; re-vote across rounds

**Files:**
- Modify: `src/app/api/voting/route.js`

**Interfaces:**
- Consumes: `getActiveEvent` from Task 3.
- Produces: `Voting` and `VotingTally` rows carry the active event's `eventId`; the upsert/where clauses include `eventId`; votes rejected (409) when no active event.

- [ ] **Step 1: Read the current voting handler**

Run: open `src/app/api/voting/route.js`. Identify where it (a) reads `choice`/`posterId`, (b) creates the `Voting` row, (c) upserts `VotingTally`. Each must include `eventId`.

- [ ] **Step 2: Add the import**

```javascript
import { getActiveEvent } from "@/lib/activeEvent";
```

- [ ] **Step 3: Resolve active event after parsing the body, before writing**

```javascript
    const active = await getActiveEvent();
    if (!active) {
      return NextResponse.json(
        { message: "No active voting round." },
        { status: 409 }
      );
    }
```

- [ ] **Step 4: Thread `eventId: active.id` into every Voting/VotingTally read and write**

- The `Voting` create `data` gains `eventId: active.id`.
- The duplicate-vote check `where` (the `@@unique` lookup) gains `eventId: active.id` — i.e. find by `{ deviceId, posterId, eventId: active.id }`.
- The `VotingTally` upsert `where` uses the compound unique `posterId_choice_eventId: { posterId, choice, eventId: active.id }` and its `create` data gains `eventId: active.id`.

> The exact Prisma compound-unique key name is `posterId_choice_eventId` (Prisma derives it from `@@unique([posterId, choice, eventId])`). Confirm against the generated client if the upsert errors.

- [ ] **Step 5: Verify a device can vote in the active event**

With an active event and a poster in it:
```bash
curl -s -X POST http://localhost:3000/api/voting \
  -H "Content-Type: application/json" \
  -b "deviceId=test-device-1" \
  -d '{"choice":"Yes","posterId":"E1-1"}'
```
Expected: success JSON (200/201), not 409.

- [ ] **Step 6: Verify the tally carries eventId**

```bash
node -e "import('./src/generated/prisma/index.js').then(async m=>{const p=new m.PrismaClient();const e=await p.event.findFirst({where:{status:'active'}});console.log(await p.votingTally.findMany({where:{eventId:e.id,posterId:'E1-1'}}));await p.\$disconnect();})"
```
Expected: a `VotingTally` row with `choice: "Yes"`, `number: 1`, the active `eventId`.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/voting/route.js
git commit -m "feat: votes scoped to active event"
```

---

### Task 7: Homepage shows active event's posters

**Files:**
- Modify: `src/app/page.js`

**Interfaces:**
- Consumes: `getActiveEvent` from Task 3.
- Produces: homepage renders only the active event's progressing posters and that event's tallies; an empty state when no event is active.

- [ ] **Step 1: Update the data fetch** — replace the top of `Home()`:

```javascript
import { getActiveEvent } from "@/lib/activeEvent";
// ...existing imports...

export const dynamic = "force-dynamic";

export default async function Home() {
  const active = await getActiveEvent();
  const poster = active
    ? await prisma.poster.findMany({
        where: { eventId: active.id, status: "progressing" },
      })
    : [];
  const vote = active
    ? await prisma.votingTally.findMany({ where: { eventId: active.id } })
    : [];
  const banner = await getBanner();
```

- [ ] **Step 2: Add an empty state** — right after `<Header src={banner} />`, before the heading block, render a notice when no event is active:

```javascript
      {!active && (
        <div className="text-center mt-16 text-muted-foreground text-lg">
          No active voting round.
        </div>
      )}
```

Wrap the existing heading + `PosterGrid` + stats in `{active && ( ... )}` so they only show during a round.

- [ ] **Step 3: Verify homepage with active event**

Run: `curl -s http://localhost:3000/ | grep -c "/poster/"`
Expected: a count > 0 (vote links for the active event's posters).

- [ ] **Step 4: Verify empty state when no active event** — close the event (Task 4 PATCH), then:

Run: `curl -s http://localhost:3000/ | grep -c "No active voting round"`
Expected: `1`. Re-open an event afterward to restore normal state.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.js
git commit -m "feat: homepage scoped to active event"
```

---

### Task 8: Admin event UI

**Files:**
- Create: `src/app/(Dashbaord)/dashboard/event/page.jsx`
- Create: `src/app/(Dashbaord)/dashboard/event/EventManager.jsx`
- Modify: `src/app/Component/Navbar.jsx` (add admin-only "Events" link)

**Interfaces:**
- Consumes: `@/auth`, `getActiveEvent`, `@/lib/prisma`, event API from Task 4.
- Produces: an admin page listing events with "New Event" (name input) and "Close Event" actions, calling `/api/event`.

- [ ] **Step 1: Server page with admin guard**

`src/app/(Dashbaord)/dashboard/event/page.jsx`:
```javascript
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import Navbar from "@/app/Component/Navbar";
import EventManager from "./EventManager";

export const dynamic = "force-dynamic";

export default async function EventPage() {
  const session = await auth();
  if (session?.user?.role !== "Admin") {
    return (
      <>
        <Navbar />
        <div className="text-center mt-20 text-red-500 text-xl font-semibold">
          You&apos;re not authorized to view this page.
        </div>
      </>
    );
  }
  const events = await prisma.event.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <>
      <Navbar />
      <EventManager events={events} />
    </>
  );
}
```

- [ ] **Step 2: Client manager component**

`src/app/(Dashbaord)/dashboard/event/EventManager.jsx`:
```javascript
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function EventManager({ events }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const active = events.find((e) => e.status === "active");

  const open = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const res = await fetch("/api/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Event opened");
      setName("");
      router.refresh();
    } else {
      toast.error("Failed to open event");
    }
  };

  const close = async () => {
    setBusy(true);
    const res = await fetch("/api/event", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close" }),
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Event closed");
      router.refresh();
    } else {
      toast.error("Failed to close event");
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Voting Events</h1>

      <form onSubmit={open} className="flex gap-2 mb-6">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New event name"
          className="border px-3 py-2 flex-1"
        />
        <button
          type="submit"
          disabled={busy}
          className="bg-blue-500 text-white px-4 py-2 cursor-pointer disabled:opacity-60"
        >
          New Event
        </button>
      </form>

      {active && (
        <button
          onClick={close}
          disabled={busy}
          className="bg-red-500 text-white px-4 py-2 mb-6 cursor-pointer disabled:opacity-60"
        >
          Close active event ({active.name})
        </button>
      )}

      <ul className="space-y-2">
        {events.map((ev) => (
          <li
            key={ev.id}
            className="border p-3 flex justify-between items-center"
          >
            <span>{ev.name}</span>
            <span
              className={
                ev.status === "active" ? "text-green-600" : "text-gray-500"
              }
            >
              {ev.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Add admin-only nav link** — in `src/app/Component/Navbar.jsx`, inside the existing `{isAdmin && ( ... )}` block, add:

```javascript
                <li>
                  <a
                    href="/dashboard/event"
                    className="block text-sm md:text-lg bg-transparent md:p-0 dark:text-white text-blue-500 px-1"
                  >
                    Events
                  </a>
                </li>
```

- [ ] **Step 4: Verify page renders for admin**

Run: `curl -s -b cookies.txt http://localhost:3000/dashboard/event | grep -c "Voting Events"`
Expected: `1`

- [ ] **Step 5: Verify non-admin is blocked**

Run: `curl -s http://localhost:3000/dashboard/event | grep -c "not authorized"`
Expected: `1`

- [ ] **Step 6: Commit**

```bash
git add "src/app/(Dashbaord)/dashboard/event" src/app/Component/Navbar.jsx
git commit -m "feat: admin event management UI"
```

---

## Self-Review

**Spec coverage:**
- Event model + EventStatus → Task 1 ✓
- eventId on Poster/Voting/VotingTally/ResultArchive + uniqueness → Task 1 ✓
- One active event invariant (close-on-open) → Task 4 ✓
- Re-vote across rounds → Task 1 (uniqueness) + Task 6 ✓
- Homepage active-event scoping + empty state → Task 7 ✓
- Create poster attaches eventId / 409 no event → Task 5 ✓
- Vote writes eventId / 409 no event → Task 6 ✓
- Admin event UI (list, new, close + archive) → Task 4 (API) + Task 8 (UI) ✓
- Legacy migration into closed "Legacy" event → Task 2 ✓

**Ordering note:** Task 1 (schema) → Task 2 (migrate) must run before any code filters on `eventId` (Tasks 5–7), mirroring the status-backfill ordering lesson. Task 4 opens the first real active event after migration.

**Known follow-ups (out of scope):** poster `status` ("progressing"/"done") still coexists with event status — per-poster done-marking inside a round is unchanged. Voters do not browse closed events.
