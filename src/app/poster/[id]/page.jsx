import React from "react";
import prisma from "@/lib/prisma";
import { getBanner } from "@/lib/getBanner";
import Poster from "./Poster";

const PosterPage = async ({ params }) => {
  const { id } = await params;
  const poster = await prisma.poster.findFirst({ where: { posterId: id } });
  const closed = !poster || poster.status === "done";
  const banner = await getBanner();
  return (
    <div>
      <Poster posterId={id} closed={closed} banner={banner} />
    </div>
  );
};

export default PosterPage;
