# Project Status & Done Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reversible `progressing`/`done` status to projects so the homepage shows only live projects and the dashboard can retire projects individually or all at once, closing their voting.

**Architecture:** Add a `Status` enum + `status` field to the `Poster` model. Homepage filters to `progressing`. Vote API and poster page reject `done`. A new session-guarded `PATCH /api/poster` toggles one project or marks all progressing projects done. Dashboard gains status badge, filter, per-row toggle, and a global "Mark All Done" action.

**Tech Stack:** Next.js 15.5.19 (App Router, server components), Prisma 6.8.2 + MongoDB, next-auth v5 (`auth()`), Tailwind 4 + shadcn/ui, pnpm.

## Global Constraints

- No `^` ranges — deps stay pinned (don't add/bump deps; feature needs none).
- Session auth via `auth()` from `@/auth` on all mutating API routes; never trust client body for identity.
- Status values are exactly `progressing` and `done` (lowercase, match Prisma enum).
- Verification: `pnpm exec next build --turbopack` must pass (webpack `pnpm build` EPERM is a known Windows-local issue, ignore it). No unit-test framework in repo — do not add one.
- DB-touching commands (`prisma db push`, backfill script) are run by the user; the agent prepares them and pauses.

---

### Task 1: Add status to schema + backfill existing data

**Files:**
- Modify: `prisma/schema.prisma` (Poster model + new enum)
- Create: `scripts/backfill-status.mjs`

**Interfaces:**
- Produces: `Poster.status` field (`Status` enum: `progressing` | `done`, default `progressing`); regenerated Prisma client at `src/generated/prisma`.

- [ ] **Step 1: Add enum + field to schema**

In `prisma/schema.prisma`, add the enum near the other enum and add `status` to `Poster`:

```prisma
enum Status {
  progressing
  done
}
```

```prisma
model Poster {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  userId    String
  posterId  String
  status    Status   @default(progressing)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 2: Write backfill script**

`scripts/backfill-status.mjs` — set `progressing` on every Poster missing a status. Uses the raw Mongo command via Prisma (`$runCommandRaw`) so it works before the field is required by the typed client.

```js
import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
  const res = await prisma.$runCommandRaw({
    update: "Poster",
    updates: [
      {
        q: { status: { $exists: false } },
        u: { $set: { status: "progressing" } },
        multi: true,
      },
    ],
  });
  console.log("backfill result:", JSON.stringify(res));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 3: Regenerate client**

Run: `npx prisma generate --schema D:/NextJS/ace_voting/prisma/schema.prisma`
Expected: "Generated Prisma Client".

- [ ] **Step 4: User runs DB steps (agent pauses)**

Ask the user to run, in-session via `!`:
```
! node D:/NextJS/ace_voting/scripts/backfill-status.mjs
! npx prisma db push --schema D:/NextJS/ace_voting/prisma/schema.prisma
```
Expected: backfill result shows `nModified` ≥ 0; db push reports schema in sync.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma scripts/backfill-status.mjs
git commit -m "add project status field + backfill script"
```

---

### Task 2: Status API — PATCH /api/poster

**Files:**
- Modify: `src/app/api/poster/route.js` (add `PATCH` export)

**Interfaces:**
- Consumes: `auth` from `@/auth`, `prisma` from `@/lib/prisma`.
- Produces: `PATCH /api/poster` accepting either `{ id: string, status: "progressing"|"done" }` (single toggle) or `{ action: "markAllDone" }` (bulk). 401 if no session, 400 on bad input, 200 on success.

- [ ] **Step 1: Add PATCH handler**

Append to `src/app/api/poster/route.js`:

```js
const VALID_STATUS = ["progressing", "done"];

export async function PATCH(request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    if (body.action === "markAllDone") {
      const result = await prisma.poster.updateMany({
        where: { status: "progressing" },
        data: { status: "done" },
      });
      return NextResponse.json(
        { message: "All progressing projects marked done", count: result.count },
        { status: 200 }
      );
    }

    const { id, status } = body;
    if (!id || !VALID_STATUS.includes(status)) {
      return NextResponse.json({ message: "Invalid id or status" }, { status: 400 });
    }

    await prisma.poster.update({ where: { id }, data: { status } });
    return NextResponse.json({ message: "Status updated" }, { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response("Failed to update status", { status: 500 });
  }
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm exec next build --turbopack`
Expected: compiles, `/api/poster` route listed, no type/lint errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/poster/route.js
git commit -m "add PATCH /api/poster: toggle status + mark all done"
```

---

### Task 3: Block voting on done projects

**Files:**
- Modify: `src/app/api/voting/route.js` (status check before insert)

**Interfaces:**
- Consumes: `prisma` (already imported), `posterId` from request body.
- Produces: vote POST returns 403 when poster missing or `done`.

- [ ] **Step 1: Add status check**

In `src/app/api/voting/route.js`, after the `posterId` validation block and before the `prisma.voting.create` try/catch, insert:

```js
    // Block voting on closed (done) projects
    const poster = await prisma.poster.findFirst({ where: { posterId } });
    if (!poster || poster.status === "done") {
      return NextResponse.json(
        { message: "Voting is closed for this project." },
        { status: 403 }
      );
    }
```

- [ ] **Step 2: Verify build**

Run: `pnpm exec next build --turbopack`
Expected: compiles clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/voting/route.js
git commit -m "block voting on done projects"
```

---

### Task 4: Homepage shows only progressing

**Files:**
- Modify: `src/app/page.js:16`

**Interfaces:**
- Consumes: `Poster.status`.
- Produces: homepage lists only `progressing` posters.

- [ ] **Step 1: Filter the query**

Change line 16 from:
```js
  const poster = await prisma.poster.findMany({});
```
to:
```js
  const poster = await prisma.poster.findMany({
    where: { status: "progressing" },
  });
```

- [ ] **Step 2: Verify build**

Run: `pnpm exec next build --turbopack`
Expected: compiles; `/` route builds.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.js
git commit -m "homepage: show only progressing projects"
```

---

### Task 5: Poster page closed state

**Files:**
- Modify: `src/app/poster/[id]/page.jsx` (fetch status, pass closed flag)
- Modify: `src/app/poster/[id]/Poster.jsx` (render closed message)

**Interfaces:**
- Consumes: `Poster.status`.
- Produces: `Poster` component accepts a `closed` boolean prop; hides form + shows message when true.

- [ ] **Step 1: Fetch status in the page**

Replace `src/app/poster/[id]/page.jsx` body with:

```jsx
import React from "react";
import prisma from "@/lib/prisma";
import Poster from "./Poster";

const PosterPage = async ({ params }) => {
  const { id } = await params;
  const poster = await prisma.poster.findFirst({ where: { posterId: id } });
  const closed = !poster || poster.status === "done";
  return (
    <div>
      <Poster posterId={id} closed={closed} />
    </div>
  );
};

export default PosterPage;
```

- [ ] **Step 2: Handle closed in the client component**

In `src/app/poster/[id]/Poster.jsx`, change the signature to accept `closed`:

```jsx
const Poster = ({ posterId, closed }) => {
```

Then, inside the voting-options box (replacing the `<div className="flex flex-col items-start space-y-2">...</div>` that holds the radios and the Submit `<Button>` block), branch on `closed`. When closed, render the message and no inputs:

```jsx
            {closed ? (
              <p className="text-red-500 font-semibold">
                Voting is closed for this project.
              </p>
            ) : (
              <>
                <div className="flex flex-col items-start space-y-2">
                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="Yes"
                      name="vote"
                      value="Yes"
                      checked={choice === "Yes"}
                      onChange={(e) => setChoice(e.target.value)}
                    />
                    <label htmlFor="Yes" className="pl-2">
                      Yes
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="No"
                      name="vote"
                      value="No"
                      checked={choice === "No"}
                      onChange={(e) => setChoice(e.target.value)}
                    />
                    <label htmlFor="No" className="pl-2">
                      No
                    </label>
                  </div>
                </div>
              </>
            )}
```

And wrap the Submit button so it only renders when not closed:

```jsx
          {!closed && (
            <Button className="mt-6" onClick={handleVote} disabled={loading}>
              {loading ? (
                <>
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit"
              )}
            </Button>
          )}
```

- [ ] **Step 3: Verify build**

Run: `pnpm exec next build --turbopack`
Expected: compiles; `/poster/[id]` builds.

- [ ] **Step 4: Commit**

```bash
git add "src/app/poster/[id]/page.jsx" "src/app/poster/[id]/Poster.jsx"
git commit -m "poster page: closed state blocks voting UI"
```

---

### Task 6: Dashboard — status badge, filter, per-row toggle, mark all done

**Files:**
- Modify: `src/app/(Dashbaord)/dashboard/Dashboard.jsx`

**Interfaces:**
- Consumes: `PATCH /api/poster`, `poster.status` from DB, `poster.dbId`.
- Produces: dashboard status column, status filter, per-row Mark Done/Reopen, header Mark All Done.

- [ ] **Step 1: Use real status in posterMap**

In the `posterData` `useMemo`, change the DB-poster init `status: poster.status || "active"` to `status: poster.status || "progressing"`, and the vote-only branch `status: "active"` to `status: "progressing"`.

- [ ] **Step 1b: Fix the status badge**

The Status `<TableCell>` badge checks `poster.status === "active"` which is never true now. Change:
```jsx
                        <Badge
                          variant={
                            poster.status === "active" ? "default" : "secondary"
                          }
                        >
```
to:
```jsx
                        <Badge
                          variant={
                            poster.status === "progressing" ? "default" : "secondary"
                          }
                        >
```

- [ ] **Step 2: Fix the status filter options**

Replace the filter `Select` items:
```jsx
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
```
with:
```jsx
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="progressing">Progressing</SelectItem>
                <SelectItem value="done">Done</SelectItem>
```

- [ ] **Step 3: Add status-toggle + mark-all handlers**

After `handleDeletePoster`, add:

```jsx
  const handleToggleStatus = async (poster) => {
    if (!poster.dbId) {
      toast.error("Cannot update: no database record");
      return;
    }
    const next = poster.status === "done" ? "progressing" : "done";
    try {
      const res = await fetch("/api/poster", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: poster.dbId, status: next }),
      });
      if (res.ok) {
        toast.success(`Poster ${poster.id} marked ${next}`);
        window.location.reload();
      } else {
        toast.error("Failed to update status");
      }
    } catch (error) {
      console.error(error);
      toast.error("An error occurred while updating status");
    }
  };

  const handleMarkAllDone = async () => {
    try {
      const res = await fetch("/api/poster", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markAllDone" }),
      });
      if (res.ok) {
        toast.success("All progressing projects marked done");
        window.location.reload();
      } else {
        toast.error("Failed to mark all done");
      }
    } catch (error) {
      console.error(error);
      toast.error("An error occurred");
    }
  };
```

- [ ] **Step 4: Add Mark All Done button to the header**

In the header `<div>` that contains the "Create New Poster" button, add before it an `AlertDialog`-wrapped button:

```jsx
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline">Mark All Done</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>End the round?</AlertDialogTitle>
                <AlertDialogDescription>
                  All progressing projects become done and leave the homepage.
                  You can reopen them individually later.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleMarkAllDone}>
                  Mark All Done
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button asChild>
            <Link href="/dashboard/poster">
              <Plus className="mr-2 h-4 w-4" />
              Create New Poster
            </Link>
          </Button>
        </div>
```
(Replace the existing single `<Button asChild>...Create New Poster...</Button>` with this wrapping `<div className="flex gap-2">`.)

- [ ] **Step 5: Add a toggle button in the Actions cell**

In the Actions `<TableCell>`, before the delete `AlertDialog`, add (wrap both in a flex container):

```jsx
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!poster.dbId}
                          onClick={() => handleToggleStatus(poster)}
                        >
                          {poster.status === "done" ? "Reopen" : "Mark Done"}
                        </Button>
                        {/* existing delete AlertDialog stays here, inside this div */}
                      </div>
```

- [ ] **Step 6: Verify build**

Run: `pnpm exec next build --turbopack`
Expected: compiles; `/dashboard` builds, no missing-import errors (AlertDialog parts already imported in this file).

- [ ] **Step 7: Commit**

```bash
git add "src/app/(Dashbaord)/dashboard/Dashboard.jsx"
git commit -m "dashboard: status badge filter, per-row toggle, mark all done"
```

---

## Manual verification (after all tasks + user DB steps)

1. Create a project → appears on homepage, status `progressing` in dashboard.
2. Vote on it → success.
3. Dashboard → Mark Done → project leaves homepage; dashboard shows `done`.
4. Visit `/poster/<id>` directly → "Voting is closed"; POST to `/api/voting` returns 403.
5. Dashboard → Reopen → back on homepage, voting works again.
6. Dashboard → Mark All Done (confirm) → homepage empty, all rows `done`.
