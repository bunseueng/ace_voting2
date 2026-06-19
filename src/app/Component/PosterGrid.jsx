"use client";

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";

export default function PosterGrid({ posters, tallies }) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("mostVotes");

  const voteOf = (posterId) => {
    const t = tallies.find((v) => v.posterId === posterId);
    return t?.number || 0;
  };

  const list = useMemo(() => {
    const filtered = posters.filter((p) =>
      p.posterId.toLowerCase().includes(search.toLowerCase())
    );
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt) - new Date(a.createdAt);
        case "oldest":
          return new Date(a.createdAt) - new Date(b.createdAt);
        case "mostVotes":
        default:
          return voteOf(b.posterId) - voteOf(a.posterId);
      }
    });
    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posters, tallies, search, sortBy]);

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <Input
          placeholder="Search by poster ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mostVotes">Most Votes</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="oldest">Oldest</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {list.map((post) => {
          const number = voteOf(post.posterId);
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
                    <span className="text-lg font-bold">{number}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(number, 100)}%` }}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-3">
                <Button asChild className="w-full">
                  <Link href={`/poster/${post.posterId}`}>Vote on Poster</Link>
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {list.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">No posters found.</p>
        </div>
      )}
    </>
  );
}
