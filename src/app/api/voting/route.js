import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rateLimit";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const VALID_CHOICES = ["Yes", "No"];

export async function POST(request) {
  try {
    // Identify device by cookie (NOT IP — students share school WiFi).
    const cookieStore = await cookies();
    let deviceId = cookieStore.get("deviceId")?.value;

    // If no deviceId cookie exists, create one
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      cookieStore.set("deviceId", deviceId, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 365, // 1 year
      });
    }

    // Rate limit per DEVICE, not per IP — shared WiFi must not block voters.
    const allowed = await rateLimit(`vote:${deviceId}`, {
      max: 30,
      windowMs: 60_000,
    });
    if (!allowed) {
      return NextResponse.json(
        { message: "Too many requests. Try again later." },
        { status: 429 }
      );
    }

    const { choice, posterId } = await request.json();

    // Validate input
    if (!VALID_CHOICES.includes(choice)) {
      return NextResponse.json(
        { message: "Invalid choice." },
        { status: 400 }
      );
    }
    if (!posterId || typeof posterId !== "string") {
      return NextResponse.json(
        { message: "Invalid posterId." },
        { status: 400 }
      );
    }

    // Block voting on closed (done) projects
    const poster = await prisma.poster.findFirst({ where: { posterId } });
    if (!poster || poster.status === "done") {
      return NextResponse.json(
        { message: "Voting is closed for this project." },
        { status: 403 }
      );
    }

    // Atomic insert — unique([deviceId, posterId]) prevents double vote.
    // Catch P2002 (unique violation) instead of racy findFirst+create.
    try {
      await prisma.voting.create({
        data: { deviceId, posterId, choice },
      });
    } catch (error) {
      if (error?.code === "P2002") {
        return NextResponse.json(
          { message: "This device has already voted for this poster." },
          { status: 400 }
        );
      }
      throw error;
    }

    // Atomic tally increment — upsert on unique([posterId, choice])
    await prisma.votingTally.upsert({
      where: { posterId_choice: { posterId, choice } },
      update: { number: { increment: 1 } },
      create: { posterId, choice, number: 1 },
    });

    return NextResponse.json(
      { message: "Vote recorded successfully." },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return new Response("Failed to create vote", { status: 500 });
  }
}

export async function GET() {
  // Admin only — raw votes include deviceIds
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const allVotes = await prisma.voting.findMany({});
    return NextResponse.json(allVotes);
  } catch (error) {
    console.error(error);
    return new Response("Failed to fetch votes", { status: 500 });
  }
}
