# SignIn / Banner / Homepage / Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a signin loading state, an admin-configurable Cloudinary banner, homepage search/sort, and a per-poster vote reset that archives the old result and reopens voting.

**Architecture:** Banner URL and other settings live in a new `Setting` key/value model; banner images upload to Cloudinary via a session-guarded API and the `secure_url` is stored. Homepage extracts its grid into a client component for search/sort. Reset extends `PATCH /api/poster` to snapshot a poster's tally into a new `ResultArchive` model, then clears its tally + vote rows. A new dashboard history page lists archives.

**Tech Stack:** Next.js 15.5.19 (App Router), Prisma 6.8.2 + MongoDB, next-auth v5 (`auth()`), Cloudinary SDK, Tailwind 4 + shadcn/ui, pnpm.

## Global Constraints

- Deps pinned exact (no `^`). New dep: `cloudinary` pinned.
- Mutating API routes session-guarded via `auth()` from `@/auth`; never trust client body for identity.
- Cloudinary env: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (user provides). Missing env → 500 with clear message, never crash.
- Banner fallback is `"/banner.jfif"` when unset.
- Verification: `pnpm exec next build --turbopack` passes. No unit-test framework — do not add one.
- DB push / generate run by the user (sandbox-gated). All file ops in `D:\NextJS\ace_voting2`.

---

### Task 1: SignIn loading state

**Files:**
- Modify: `src/app/sign_in/SignIn.jsx`

**Interfaces:**
- Produces: signin form with loading spinner + inline error, `redirect: false` flow.

- [ ] **Step 1: Rewrite the component**

```jsx
"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader } from "lucide-react";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });
      if (res?.error) {
        setError("Invalid email or password.");
        toast.error("Sign in failed.");
      } else {
        toast.success("Signed in.");
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-sm mx-auto mt-10 space-y-4 px-4">
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="border px-3 py-2 w-full"
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="border px-3 py-2 w-full"
        required
      />
      <button
        type="submit"
        disabled={loading}
        className="bg-blue-500 text-white py-2 px-4 flex items-center justify-center disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader className="mr-2 h-4 w-4 animate-spin" />
            Signing in...
          </>
        ) : (
          "Sign In"
        )}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Build** — `pnpm exec next build --turbopack` → passes.
- [ ] **Step 3: Commit** — `git commit -m "signin: loading state + inline error"`

---

### Task 2: Setting model, Cloudinary dep, banner API

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `package.json` (add `cloudinary`)
- Create: `src/lib/cloudinary.js`
- Create: `src/lib/getBanner.js`
- Create: `src/app/api/banner/route.js`

**Interfaces:**
- Produces: `Setting { key, value }` model; `getBanner(): Promise<string>`; `POST /api/banner` returning `{ url }`.

- [ ] **Step 1: Add Setting model to schema**

```prisma
model Setting {
  id    String @id @default(auto()) @map("_id") @db.ObjectId
  key   String @unique
  value String
}
```

- [ ] **Step 2: Add cloudinary dep**

In `package.json` dependencies add (alphabetical near top): `"cloudinary": "2.7.0",`. Then user runs `pnpm install` (Step 7).

- [ ] **Step 3: Cloudinary config helper**

`src/lib/cloudinary.js`:
```js
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export function cloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

export default cloudinary;
```

- [ ] **Step 4: getBanner helper**

`src/lib/getBanner.js`:
```js
import prisma from "@/lib/prisma";

export async function getBanner() {
  const setting = await prisma.setting.findUnique({ where: { key: "banner" } });
  return setting?.value || "/banner.jfif";
}
```

- [ ] **Step 5: Banner upload API**

`src/app/api/banner/route.js`:
```js
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import cloudinary, { cloudinaryConfigured } from "@/lib/cloudinary";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (!cloudinaryConfigured()) {
      return NextResponse.json(
        { message: "Cloudinary is not configured on the server." },
        { status: 500 }
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ message: "No file provided." }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const dataUri = `data:${file.type};base64,${bytes.toString("base64")}`;

    const uploaded = await cloudinary.uploader.upload(dataUri, {
      folder: "ace_voting",
    });

    await prisma.setting.upsert({
      where: { key: "banner" },
      update: { value: uploaded.secure_url },
      create: { key: "banner", value: uploaded.secure_url },
    });

    return NextResponse.json({ url: uploaded.secure_url }, { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response("Failed to upload banner", { status: 500 });
  }
}
```

- [ ] **Step 6: Generate client** — `npx prisma generate --schema D:/NextJS/ace_voting2/prisma/schema.prisma`
- [ ] **Step 7: User runs (agent pauses)** — `! pnpm -C D:/NextJS/ace_voting2 install` and `! npx prisma db push --schema D:/NextJS/ace_voting2/prisma/schema.prisma`, and add the three `CLOUDINARY_*` vars to `.env`.
- [ ] **Step 8: Build + commit** — build passes; `git commit -m "add Setting model + cloudinary banner upload API"`

---

### Task 3: Banner display

**Files:**
- Modify: `src/app/Component/Header.jsx`
- Modify: `src/app/page.js`
- Modify: `src/app/poster/[id]/page.jsx`
- Modify: `src/app/poster/[id]/Poster.jsx`

**Interfaces:**
- Consumes: `getBanner()` from Task 2.
- Produces: `Header` accepts `src` prop; `Poster` accepts `banner` prop.

- [ ] **Step 1: Header takes src prop**

`src/app/Component/Header.jsx`:
```jsx
import React from "react";

const Header = ({ src = "/banner.jfif" }) => {
  return (
    <div className="w-full h-full">
      <img
        src={src}
        alt="Poster"
        className="w-full h-auto object-cover bg-center"
      />
    </div>
  );
};

export default Header;
```

- [ ] **Step 2: Homepage passes banner**

In `src/app/page.js`, import and use getBanner. Add at top: `import { getBanner } from "@/lib/getBanner";`. In the component, after the prisma queries add `const banner = await getBanner();` and change `<Header />` to `<Header src={banner} />`.

- [ ] **Step 3: Poster page passes banner**

In `src/app/poster/[id]/page.jsx`, add `import { getBanner } from "@/lib/getBanner";`, fetch `const banner = await getBanner();`, and pass `<Poster posterId={id} closed={closed} banner={banner} />`.

- [ ] **Step 4: Poster uses banner prop**

In `src/app/poster/[id]/Poster.jsx`, change signature to `const Poster = ({ posterId, closed, banner }) => {` and the `<img src="/banner.jfif" ...>` to `<img src={banner || "/banner.jfif"} ...>`.

- [ ] **Step 5: Build + commit** — build passes; `git commit -m "banner: read from Setting, fall back to /banner.jfif"`

---

### Task 4: Banner upload UI in dashboard

**Files:**
- Create: `src/app/(Dashbaord)/dashboard/BannerCard.jsx`
- Modify: `src/app/(Dashbaord)/dashboard/page.jsx`
- Modify: `src/app/(Dashbaord)/dashboard/Dashboard.jsx`

**Interfaces:**
- Consumes: `POST /api/banner`, `getBanner()`.
- Produces: `BannerCard` client component receiving `currentBanner` prop.

- [ ] **Step 1: BannerCard component**

`src/app/(Dashbaord)/dashboard/BannerCard.jsx`:
```jsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader } from "lucide-react";
import { toast } from "sonner";

export default function BannerCard({ currentBanner }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!file) {
      toast.error("Choose an image first");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/banner", { method: "POST", body: form });
      if (res.ok) {
        toast.success("Banner updated");
        window.location.reload();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || "Upload failed");
      }
    } catch (err) {
      console.error(err);
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Homepage Banner</CardTitle>
        <CardDescription>Upload an image to replace the banner.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentBanner && (
          <img
            src={currentBanner}
            alt="Current banner"
            className="w-full max-h-40 object-cover rounded border"
          />
        )}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <Button onClick={handleUpload} disabled={uploading}>
          {uploading ? (
            <>
              <Loader className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            "Upload Banner"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Pass banner into Dashboard**

In `src/app/(Dashbaord)/dashboard/page.jsx`, add `import { getBanner } from "@/lib/getBanner";`, fetch `const banner = await getBanner();`, and pass `<Dashboard voting={voting} posters={posters} userId={userId} banner={banner} />`.

- [ ] **Step 3: Render BannerCard in Dashboard**

In `src/app/(Dashbaord)/dashboard/Dashboard.jsx`: add `import BannerCard from "./BannerCard";` at top; change the signature to `export default function Dashboard({ voting, posters, userId, banner }) {`; render `<BannerCard currentBanner={banner} />` right after the header `</div>` (before the Summary Cards grid).

- [ ] **Step 4: Build + commit** — build passes; `git commit -m "dashboard: banner upload card"`

---

### Task 5: Homepage search + sort

**Files:**
- Create: `src/app/Component/PosterGrid.jsx`
- Modify: `src/app/page.js`

**Interfaces:**
- Consumes: `posters` (array with `id`, `posterId`, `createdAt`), `tallies` (votingTally array).
- Produces: `PosterGrid` client component with search + sort.

- [ ] **Step 1: PosterGrid component**

`src/app/Component/PosterGrid.jsx`:
```jsx
"use client";

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";

export default function PosterGrid({ posters, tallies }) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("mostVotes");

  const voteOf = (posterId) => {
    const t = tallies.find((v) => v.posterId === posterId);
    return t?.number || 0;
  };

  const list = useMemo(() => {
    const filtered = posters.filter((p) =>
      p.posterId.toLowerCase().includes(search.toLowerCase())
    );
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt) - new Date(a.createdAt);
        case "oldest":
          return new Date(a.createdAt) - new Date(b.createdAt);
        case "mostVotes":
        default:
          return voteOf(b.posterId) - voteOf(a.posterId);
      }
    });
    return sorted;
  }, [posters, tallies, search, sortBy]);

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <Input
          placeholder="Search by poster ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mostVotes">Most Votes</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="oldest">Oldest</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {list.map((post) => {
          const number = voteOf(post.posterId);
          return (
            <Card key={post.id} className="w-full h-full flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg md:text-xl">
                  Poster {post.posterId}
                </CardTitle>
                <CardDescription className="text-sm">
                  Click to view and vote on this poster
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 pb-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      Total Votes:
                    </span>
                    <span className="text-lg font-bold">{number}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(number, 100)}%` }}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-3">
                <Button asChild className="w-full">
                  <Link href={`/poster/${post.posterId}`}>Vote on Poster</Link>
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {list.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">No posters found.</p>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Use PosterGrid in homepage**

In `src/app/page.js`: import `PosterGrid`, replace the existing grid `<div className="grid ...">...</div>` AND the empty-state block with `<PosterGrid posters={poster} tallies={vote} />`. Keep the title header and the "Voting Summary" stats block. Keep the `where: { status: "progressing" }` query.

- [ ] **Step 3: Build + commit** — build passes; `git commit -m "homepage: search + sort via PosterGrid"`

---

### Task 6: ResultArchive model + reset action

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/app/api/poster/route.js` (extend PATCH)

**Interfaces:**
- Consumes: existing PATCH handler, `auth()`, `prisma`.
- Produces: `ResultArchive` model; `PATCH /api/poster { action: "reset", posterId }`.

- [ ] **Step 1: Add ResultArchive model**

```prisma
model ResultArchive {
  id         String   @id @default(auto()) @map("_id") @db.ObjectId
  posterId   String
  yesVotes   Int      @default(0)
  noVotes    Int      @default(0)
  archivedAt DateTime @default(now())
}
```

- [ ] **Step 2: Extend PATCH with reset**

In `src/app/api/poster/route.js`, inside `PATCH`, after the `markAllDone` block and before the `{ id, status }` handling, add:

```js
    if (body.action === "reset") {
      const { posterId } = body;
      if (!posterId) {
        return NextResponse.json({ message: "Missing posterId" }, { status: 400 });
      }
      const tallies = await prisma.votingTally.findMany({ where: { posterId } });
      const yesVotes = tallies.find((t) => t.choice === "Yes")?.number || 0;
      const noVotes = tallies.find((t) => t.choice === "No")?.number || 0;

      await prisma.$transaction([
        prisma.resultArchive.create({
          data: { posterId, yesVotes, noVotes },
        }),
        prisma.votingTally.deleteMany({ where: { posterId } }),
        prisma.voting.deleteMany({ where: { posterId } }),
      ]);

      return NextResponse.json(
        { message: "Result archived and votes reset" },
        { status: 200 }
      );
    }
```

- [ ] **Step 3: Generate + user db push** — `npx prisma generate --schema D:/NextJS/ace_voting2/prisma/schema.prisma`; user runs `! npx prisma db push --schema D:/NextJS/ace_voting2/prisma/schema.prisma`.
- [ ] **Step 4: Build + commit** — build passes; `git commit -m "add ResultArchive + reset action (archive, zero, reopen voting)"`

---

### Task 7: Dashboard reset button + history link

**Files:**
- Modify: `src/app/(Dashbaord)/dashboard/Dashboard.jsx`

**Interfaces:**
- Consumes: `PATCH /api/poster { action: "reset", posterId }`.
- Produces: per-row Reset button; header History link.

- [ ] **Step 1: Add reset handler**

After `handleMarkAllDone` in `Dashboard.jsx`, add:
```jsx
  const handleReset = async (poster) => {
    try {
      const res = await fetch("/api/poster", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset", posterId: poster.id }),
      });
      if (res.ok) {
        toast.success(`Poster ${poster.id} votes reset (old result archived)`);
        window.location.reload();
      } else {
        toast.error("Failed to reset votes");
      }
    } catch (error) {
      console.error(error);
      toast.error("An error occurred while resetting");
    }
  };
```

- [ ] **Step 2: Add Reset button in Actions cell**

In the Actions cell flex container (which holds Mark Done/Reopen + Delete), add before the delete `AlertDialog`:
```jsx
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" disabled={!poster.dbId}>
                              Reset
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Reset votes?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Archive the current result and reset votes to zero.
                                Everyone can vote again on Poster {poster.id}.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleReset(poster)}>
                                Reset
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
```

- [ ] **Step 3: Add History link in header**

In the header `<div className="flex gap-2">` (with Mark All Done + Create), add a button before Mark All Done:
```jsx
          <Button asChild variant="outline">
            <Link href="/dashboard/history">History</Link>
          </Button>
```

- [ ] **Step 4: Build + commit** — build passes; `git commit -m "dashboard: per-row reset + history link"`

---

### Task 8: History page

**Files:**
- Create: `src/app/(Dashbaord)/dashboard/history/page.jsx`

**Interfaces:**
- Consumes: `prisma.resultArchive`, `auth()`.

- [ ] **Step 1: History page**

`src/app/(Dashbaord)/dashboard/history/page.jsx`:
```jsx
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import Navbar from "@/app/Component/Navbar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const HistoryPage = async () => {
  const session = await auth();
  if (!session?.user?.name) {
    return (
      <>
        <Navbar />
        <div className="text-center mt-20 text-red-500 text-xl font-semibold">
          You&apos;re not authorized to view this page.
        </div>
      </>
    );
  }

  const archives = await prisma.resultArchive.findMany({
    orderBy: { archivedAt: "desc" },
  });

  return (
    <>
      <Navbar />
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold mb-6">Archived Results</h1>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Poster ID</TableHead>
                <TableHead className="text-center">Yes</TableHead>
                <TableHead className="text-center">No</TableHead>
                <TableHead className="text-center">Total</TableHead>
                <TableHead>Archived</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {archives.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.posterId}</TableCell>
                  <TableCell className="text-center">{a.yesVotes}</TableCell>
                  <TableCell className="text-center">{a.noVotes}</TableCell>
                  <TableCell className="text-center">
                    {a.yesVotes + a.noVotes}
                  </TableCell>
                  <TableCell>
                    {new Date(a.archivedAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {archives.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            No archived results yet.
          </p>
        )}
      </div>
    </>
  );
};

export default HistoryPage;
```

- [ ] **Step 2: Build + commit** — build passes; `git commit -m "add dashboard history page for archived results"`

---

## Manual verification (after user adds Cloudinary env + db push)

1. `/sign_in` → submit shows spinner; bad creds → inline error + toast.
2. Dashboard → upload banner → appears on homepage + poster page.
3. Homepage → search filters by id; sort reorders (Most Votes default).
4. Dashboard → Reset a poster → counts zero, archive row appears in History, the same device can vote again.
5. `/dashboard/history` lists archives newest-first.
