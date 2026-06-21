import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import Navbar from "@/app/Component/Navbar";
import { getActiveEvent } from "@/lib/activeEvent";
import QrSheet from "./QrSheet";

export const dynamic = "force-dynamic";

export default async function QrPage() {
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

  const active = await getActiveEvent();
  if (!active) {
    return (
      <>
        <Navbar />
        <div className="text-center mt-20 text-muted-foreground text-lg">
          No active event. Open one first to generate its QR codes.
        </div>
      </>
    );
  }

  const posters = await prisma.poster.findMany({
    where: { eventId: active.id },
    orderBy: { posterId: "asc" },
  });

  return (
    <>
      <div className="print:hidden">
        <Navbar />
      </div>
      <QrSheet eventName={active.name} posters={posters} />
    </>
  );
}
