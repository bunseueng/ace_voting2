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
  const [events, grouped] = await Promise.all([
    prisma.event.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.poster.groupBy({ by: ["eventId"], _count: { _all: true } }),
  ]);
  const countByEvent = Object.fromEntries(
    grouped.map((g) => [g.eventId, g._count._all])
  );
  const withCounts = events.map((ev) => ({
    ...ev,
    posterCount: countByEvent[ev.id] ?? 0,
  }));
  return (
    <>
      <Navbar />
      <EventManager events={withCounts} />
    </>
  );
}
