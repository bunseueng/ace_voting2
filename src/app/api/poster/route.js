import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { posterId } = await request.json();
    if (!posterId || typeof posterId !== "string") {
      return NextResponse.json(
        { message: "Invalid posterId" },
        { status: 400 }
      );
    }

    await prisma.poster.create({
      data: {
        userId: session.user.id,
        posterId,
      },
    });

    return NextResponse.json(
      { message: "Poster successfully created" },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return new Response("Failed to create poster", { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id, posterId } = await request.json();
    if (!id || !posterId) {
      return NextResponse.json(
        { message: "Missing id or posterId" },
        { status: 400 }
      );
    }

    await prisma.$transaction([
      prisma.voting.deleteMany({ where: { posterId } }),
      prisma.votingTally.deleteMany({ where: { posterId } }),
      prisma.poster.delete({ where: { id } }),
    ]);

    return NextResponse.json(
      { message: "Poster successfully deleted" },
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return new Response("Failed to delete poster", { status: 500 });
  }
}

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

    if (body.action === "reset") {
      const { posterId } = body;
      if (!posterId) {
        return NextResponse.json(
          { message: "Missing posterId" },
          { status: 400 }
        );
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

    const { id, status } = body;
    if (!id || !VALID_STATUS.includes(status)) {
      return NextResponse.json(
        { message: "Invalid id or status" },
        { status: 400 }
      );
    }

    await prisma.poster.update({ where: { id }, data: { status } });
    return NextResponse.json({ message: "Status updated" }, { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response("Failed to update status", { status: 500 });
  }
}
