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
  const withCounts = await Promise.all(
    events.map(async (ev) => ({
      ...ev,
      posterCount: await prisma.poster.count({ where: { eventId: ev.id } }),
    }))
  );
  return (
    <>
      <Navbar />
      <EventManager events={withCounts} />
    </>
  );
}
