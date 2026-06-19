import React from "react";
import prisma from "@/lib/prisma";
import Poster from "./Poster";

const PosterPage = async ({ params }) => {
  const { id } = await params;
  const poster = await prisma.poster.findFirst({ where: { posterId: id } });
  const closed = !poster || poster.status === "done";
  return (
    <div>
      <Poster posterId={id} closed={closed} />
    </div>
  );
};

export default PosterPage;
