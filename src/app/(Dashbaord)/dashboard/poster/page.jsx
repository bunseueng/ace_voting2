import React from "react";
import { auth } from "@/auth"; // or wherever your auth comes from
import prisma from "@/lib/prisma";
import CreatePoster from "./CreatePoster";
import Navbar from "@/app/Component/Navbar";

export const dynamic = "force-dynamic";

const CreatePosterPage = async () => {
  const session = await auth();
  const userId = session?.user.name; // Also fetch posters to get their titles and status
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
  const events = await prisma.event.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, status: true },
  });
  return (
    <>
      <Navbar /> <CreatePoster userId={userId} events={events} />
    </>
  );
};

export default CreatePosterPage;
