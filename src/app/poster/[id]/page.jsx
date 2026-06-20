import React from "react";
import prisma from "@/lib/prisma";
import { getBanner } from "@/lib/getBanner";
import { getActiveEvent } from "@/lib/activeEvent";
import Poster from "./Poster";

export const dynamic = "force-dynamic";

const PosterPage = async ({ params }) => {
  const { id } = await params;
  const active = await getActiveEvent();
  const poster = active
    ? await prisma.poster.findFirst({
        where: { posterId: id, eventId: active.id },
      })
    : null;
  const closed = !poster || poster.status === "done";
  const banner = await getBanner();
  const title = active?.name || "Poster Exhibition";
  return (
    <div>
      <Poster posterId={id} closed={closed} banner={banner} title={title} />
    </div>
  );
};

export default PosterPage;
