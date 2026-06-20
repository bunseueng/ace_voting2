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
  const { name, clonePostersFrom } = await request.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ message: "Invalid name" }, { status: 400 });
  }

  const result = await prisma.$transaction([
    prisma.event.updateMany({
      where: { status: "active" },
      data: { status: "closed", closedAt: new Date() },
    }),
    prisma.event.create({ data: { name: name.trim(), status: "active" } }),
  ]);
  const created = result[result.length - 1];

  // Optionally clone the poster list from a previous event — posters only,
  // votes start at 0 (no Voting/VotingTally rows copied).
  let cloned = 0;
  if (clonePostersFrom) {
    const source = await prisma.poster.findMany({
      where: { eventId: clonePostersFrom },
    });
    if (source.length) {
      await prisma.poster.createMany({
        data: source.map((p) => ({
          userId: p.userId,
          posterId: p.posterId,
          eventId: created.id,
          status: "progressing",
        })),
      });
      cloned = source.length;
    }
  }

  revalidatePath("/");
  revalidatePath("/dashboard");
  return NextResponse.json(
    { message: "Event opened", event: created, clonedPosters: cloned },
    { status: 201 }
  );
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

export async function DELETE(request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { id } = await request.json();
  if (!id || typeof id !== "string") {
    return NextResponse.json({ message: "Invalid id" }, { status: 400 });
  }
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) {
    return NextResponse.json({ message: "Event not found" }, { status: 404 });
  }

  // Remove the event and all data scoped to it.
  await prisma.$transaction([
    prisma.voting.deleteMany({ where: { eventId: id } }),
    prisma.votingTally.deleteMany({ where: { eventId: id } }),
    prisma.resultArchive.deleteMany({ where: { eventId: id } }),
    prisma.poster.deleteMany({ where: { eventId: id } }),
    prisma.event.delete({ where: { id } }),
  ]);

  revalidatePath("/");
  revalidatePath("/dashboard");
  return NextResponse.json({ message: "Event deleted" }, { status: 200 });
}
