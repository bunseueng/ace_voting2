import prisma from "@/lib/prisma";
import React from "react";
import Dashboard from "./Dashboard";
import { auth } from "@/auth";
import Navbar from "@/app/Component/Navbar";
import { getBanner } from "@/lib/getBanner";
import { getActiveEvent } from "@/lib/activeEvent";
export const dynamic = "force-dynamic";

const DashboardPage = async ({ searchParams }) => {
  const session = await auth();
  const userId = session?.user?.id;
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

  const [active, banner, events, sp] = await Promise.all([
    getActiveEvent(),
    getBanner(),
    prisma.event.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, status: true },
    }),
    Promise.resolve(searchParams),
  ]);

  if (events.length === 0) {
    return (
      <>
        <Navbar />
        <div className="text-center mt-20 text-muted-foreground text-lg">
          No events yet. Create an event first.
        </div>
      </>
    );
  }

  // Selected event: ?eventId, else the active one, else the newest.
  const requestedId = sp?.eventId;
  const selected =
    events.find((e) => e.id === requestedId) ||
    events.find((e) => e.status === "active") ||
    events[0];
  const isActive = selected.status === "active";

  const [voting, posters] = await Promise.all([
    prisma.votingTally.findMany({ where: { eventId: selected.id } }),
    prisma.poster.findMany({ where: { eventId: selected.id } }),
  ]);

  return (
    <>
      <Navbar />
      <Dashboard
        voting={voting}
        posters={posters}
        userId={userId}
        banner={banner}
        events={events}
        selectedEventId={selected.id}
        selectedEventName={selected.name}
        isActive={isActive}
      />
    </>
  );
};

export default DashboardPage;
