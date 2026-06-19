import prisma from "@/lib/prisma";
import React from "react";
import Dashboard from "./Dashboard";
import { auth } from "@/auth";
import Navbar from "@/app/Component/Navbar";
import { getBanner } from "@/lib/getBanner";
export const dynamic = "force-dynamic";

const DashboardPage = async () => {
  const voting = await prisma.votingTally.findMany();
  const posters = await prisma.poster.findMany();
  const banner = await getBanner();
  // Also fetch posters to get their titles and status
  const session = await auth();
  const userId = session?.user.id;
  if (!session?.user.name) {
    return (
      <>
        <Navbar />
        <div className="text-center mt-20 text-red-500 text-xl font-semibold">
          You&apos;re not authorized to view this page.
        </div>
      </>
    );
  }
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
