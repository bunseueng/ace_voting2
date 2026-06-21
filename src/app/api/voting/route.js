import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rateLimit";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getActiveEvent } from "@/lib/activeEvent";

const VALID_CHOICES = ["Yes", "No"];

export async function POST(request) {
  try {
    const { choice, posterId, fp } = await request.json();

    // Identify the voter by browser fingerprint (resists incognito + cookie
    // clearing on the same device). Fall back to a cookie id when
    // fingerprinting is unavailable. NOT IP — students share school WiFi.
    const cookieStore = await cookies();
    let cookieId = cookieStore.get("deviceId")?.value;
    if (!cookieId) {
      cookieId = crypto.randomUUID();
      cookieStore.set("deviceId", cookieId, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 365, // 1 year
      });
    }
    const deviceId =
      typeof fp === "string" && fp.trim() ? `fp:${fp.trim()}` : cookieId;

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

    // Resolve the active voting round — reject if none.
    const active = await getActiveEvent();
    if (!active) {
      return NextResponse.json(
        { message: "No active voting round." },
        { status: 409 }
      );
    }

    // Block voting on closed (done) projects
    const poster = await prisma.poster.findFirst({ where: { posterId, eventId: active.id } });
    if (!poster || poster.status === "done") {
      return NextResponse.json(
        { message: "Voting is closed for this project." },
        { status: 403 }
      );
    }

    // Atomic insert — unique([deviceId, posterId, eventId]) prevents double vote per round.
    // Catch P2002 (unique violation) instead of racy findFirst+create.
    try {
      await prisma.voting.create({
        data: { deviceId, posterId, choice, eventId: active.id },
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

    // Atomic tally increment — upsert on unique([posterId, choice, eventId])
    await prisma.votingTally.upsert({
      where: { posterId_choice_eventId: { posterId, choice, eventId: active.id } },
      update: { number: { increment: 1 } },
      create: { posterId, choice, eventId: active.id, number: 1 },
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
