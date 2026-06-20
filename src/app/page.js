import Header from "./Component/Header";
import PosterGrid from "./Component/PosterGrid";
import prisma from "@/lib/prisma";
import Navbar from "./Component/Navbar";
import { getBanner } from "@/lib/getBanner";

export const dynamic = "force-dynamic";

export default async function Home() {
  const poster = await prisma.poster.findMany({
    where: { status: "progressing" },
  });
  const vote = await prisma.votingTally.findMany();
  const banner = await getBanner();

  return (
    <>
      <Navbar />
      <Header src={banner} />
      <div className="container mx-auto px-4 py-6">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-center mb-2">
            Poster Voting Dashboard
          </h1>
          <p className="text-muted-foreground text-center text-sm md:text-base">
            Vote on your favorite posters and see real-time results
          </p>
        </div>

        <PosterGrid posters={poster} tallies={vote} />

        {/* Stats Summary */}
        {poster.length > 0 && (
          <div className="mt-12 bg-muted/50 rounded-lg p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-semibold mb-4 text-center">
              Voting Summary
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-primary">
                  {poster.length}
                </div>
                <div className="text-sm text-muted-foreground">
                  Total Posters
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-green-600">
                  {vote.reduce((sum, v) => sum + (v.number || 0), 0)}
                </div>
                <div className="text-sm text-muted-foreground">Total Votes</div>
              </div>
              <div className="text-center col-span-2 md:col-span-1">
                <div className="text-2xl md:text-3xl font-bold text-blue-600">
                  {poster.length > 0
                    ? Math.round(
                        vote.reduce((sum, v) => sum + (v.number || 0), 0) /
                          poster.length
                      )
                    : 0}
                </div>
                <div className="text-sm text-muted-foreground">
                  Avg Votes/Poster
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
