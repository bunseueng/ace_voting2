import prisma from "@/lib/prisma";
import React from "react";
import Dashboard from "./Dashboard";
import { auth } from "@/auth";
import Navbar from "@/app/Component/Navbar";
import { getBanner } from "@/lib/getBanner";
import { getActiveEvent } from "@/lib/activeEvent";
export const dynamic = "force-dynamic";

const DashboardPage = async () => {
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

  const [active, banner] = await Promise.all([getActiveEvent(), getBanner()]);

  if (!active) {
    return (
      <>
        <Navbar />
        <div className="text-center mt-20 text-muted-foreground text-lg">
          No active voting round.
        </div>
      </>
    );
  }

  const [voting, posters] = await Promise.all([
    prisma.votingTally.findMany({ where: { eventId: active.id } }),
    prisma.poster.findMany({ where: { eventId: active.id } }),
  ]);

  return (
    <>
      <Navbar />
      <Dashboard
        voting={voting}
        posters={posters}
        userId={userId}
        banner={banner}
      />
    </>
  );
};

export default DashboardPage;
