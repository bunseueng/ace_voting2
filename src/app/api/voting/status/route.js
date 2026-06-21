import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getActiveEvent } from "@/lib/activeEvent";

// Returns whether THIS voter (fingerprint, else cookie) has already voted on a
// poster in the active event. Used by the poster page to disable the button.
export async function POST(request) {
  try {
    const { posterId, fp } = await request.json();
    if (!posterId || typeof posterId !== "string") {
      return NextResponse.json({ voted: false }, { status: 200 });
    }

    const active = await getActiveEvent();
    if (!active) return NextResponse.json({ voted: false }, { status: 200 });

    const cookieId = (await cookies()).get("deviceId")?.value;
    const deviceId =
      typeof fp === "string" && fp.trim() ? `fp:${fp.trim()}` : cookieId;
    if (!deviceId) return NextResponse.json({ voted: false }, { status: 200 });

    const existing = await prisma.voting.findFirst({
      where: { deviceId, posterId, eventId: active.id },
    });
    return NextResponse.json({ voted: !!existing }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ voted: false }, { status: 200 });
  }
}
