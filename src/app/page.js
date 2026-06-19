import Header from "./Component/Header";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import prisma from "@/lib/prisma";
import Link from "next/link";
import Navbar from "./Component/Navbar";

export default async function Home() {
  const poster = await prisma.poster.findMany({
    where: { status: "progressing" },
  });
  const vote = await prisma.votingTally.findMany();

  return (
    <>
      <Navbar />
      <Header />
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

        {/* Responsive Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {poster.map((post) => {
            const totalVote = vote.find((v) => v.posterId === post.posterId);

            return (
              <Card key={post.id} className="w-full h-full flex flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg md:text-xl">
                    Poster {post.posterId}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Click to view and vote on this poster
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1 pb-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">
                        Total Votes:
                      </span>
                      <span className="text-lg font-bold">
                        {totalVote?.number ? totalVote.number : 0}
                      </span>
                    </div>

                    {/* Vote indicator */}
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{
                          width: totalVote?.number
                            ? `${Math.min(
                                (totalVote.number / 100) * 100,
                                100
                              )}%`
                            : "0%",
                        }}
                      />
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="pt-3">
                  <Button asChild className="w-full">
                    <Link href={`/poster/${post.posterId}`}>
                      Vote on Poster
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* Empty State */}
        {poster.length === 0 && (
          <div className="text-center py-12">
            <div className="text-muted-foreground mb-4">
              <svg
                className="mx-auto h-12 w-12 text-muted-foreground/50"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              No posters available
            </h3>
            <p className="text-sm text-muted-foreground">
              Check back later for new posters to vote on.
            </p>
          </div>
        )}

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
