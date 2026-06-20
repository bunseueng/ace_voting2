import React from "react";
import { cookies } from "next/headers";
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

  // Has THIS device already voted on this poster in the active event?
  const deviceId = (await cookies()).get("deviceId")?.value;
  const alreadyVoted =
    !!active && !!deviceId
      ? !!(await prisma.voting.findFirst({
          where: { deviceId, posterId: id, eventId: active.id },
        }))
      : false;

  const banner = await getBanner();
  const title = active?.name || "Poster Exhibition";
  return (
    <div>
      <Poster
        posterId={id}
        closed={closed}
        banner={banner}
        title={title}
        alreadyVoted={alreadyVoted}
      />
    </div>
  );
};

export default PosterPage;
