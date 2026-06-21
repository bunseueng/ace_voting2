import React from "react";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { getBanner } from "@/lib/getBanner";
import { getActiveEvent } from "@/lib/activeEvent";
import Poster from "./Poster";

export const dynamic = "force-dynamic";

const PosterPage = async ({ params }) => {
  const { id } = await params;
  const [active, banner, cookieStore] = await Promise.all([
    getActiveEvent(),
    getBanner(),
    cookies(),
  ]);
  const deviceId = cookieStore.get("deviceId")?.value;

  // Poster lookup + this-device prior-vote check run together.
  const [poster, priorVote] = active
    ? await Promise.all([
        prisma.poster.findFirst({
          where: { posterId: id, eventId: active.id },
        }),
        deviceId
          ? prisma.voting.findFirst({
              where: { deviceId, posterId: id, eventId: active.id },
            })
          : Promise.resolve(null),
      ])
    : [null, null];

  const closed = !poster || poster.status === "done";
  const alreadyVoted = !!priorVote;
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
