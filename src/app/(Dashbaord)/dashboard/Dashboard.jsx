"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Search,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Plus,
  Trash2,
  Loader,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import BannerCard from "./BannerCard";

export default function Dashboard({ voting, posters, userId, banner }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("totalVotes");
  const [filterStatus, setFilterStatus] = useState("all");
  const [deletingPoster, setDeletingPoster] = useState(null);

  // Process voting data to create poster data with vote counts
  const posterData = useMemo(() => {
    const posterMap = new Map();

    // Initialize with posters from database
    posters.forEach((poster) => {
      posterMap.set(poster.posterId, {
        id: poster.posterId,
        title: `Poster ${poster.posterId}`,
        createdDate: poster.createdAt,
        yesVotes: 0,
        noVotes: 0,
        status: poster.status || "progressing",
        firstVoteDate: poster.createdAt,
        dbId: poster.id,
      });
    });

    // Process each vote
    voting.forEach((vote) => {
      if (!posterMap.has(vote.posterId)) {
        posterMap.set(vote.posterId, {
          id: vote.posterId,
          title: `Poster ${vote.posterId}`,
          createdDate: vote.createdAt,
          yesVotes: 0,
          noVotes: 0,
          status: "progressing",
          firstVoteDate: vote.createdAt,
          dbId: null,
        });
      }

      const poster = posterMap.get(vote.posterId);

      // Count votes using the 'number' field
      if (vote.choice === "Yes") {
        poster.yesVotes += vote.number || 1; // Use vote.number if exists, default to 1
      } else if (vote.choice === "No") {
        poster.noVotes += vote.number || 1;
      }

      // Track earliest vote date
      if (vote.createdAt < poster.firstVoteDate) {
        poster.firstVoteDate = vote.createdAt;
        poster.createdDate = vote.createdAt;
      }

      posterMap.set(vote.posterId, poster);
    });

    return Array.from(posterMap.values());
  }, [voting, posters]);

  // Calculate summary statistics
  const totalPosters = posterData.length;
  const totalYesVotes = posterData.reduce(
    (sum, poster) => sum + poster.yesVotes,
    0
  );
  const totalNoVotes = posterData.reduce(
    (sum, poster) => sum + poster.noVotes,
    0
  );
  const totalVotes = totalYesVotes + totalNoVotes;
  const approvalRate =
    totalVotes > 0 ? ((totalYesVotes / totalVotes) * 100).toFixed(1) : "0";

  // Filter and sort posters
  const filteredPosters = posterData
    .filter((poster) => {
      const matchesSearch =
        poster.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        poster.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        filterStatus === "all" || poster.status === filterStatus;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "yesVotes":
          return b.yesVotes - a.yesVotes;
        case "noVotes":
          return b.noVotes - a.noVotes;
        case "totalVotes":
          return b.yesVotes + b.noVotes - (a.yesVotes + a.noVotes);
        case "createdDate":
        default:
          return (
            new Date(b.createdDate).getTime() -
            new Date(a.createdDate).getTime()
          );
      }
    });

  const getApprovalRate = (yesVotes, noVotes) => {
    const total = yesVotes + noVotes;
    return total > 0 ? ((yesVotes / total) * 100).toFixed(1) : "0";
  };

  const getApprovalBadge = (rate) => {
    if (rate >= 70)
      return <Badge className="bg-green-100 text-green-800">High</Badge>;
    if (rate >= 50)
      return <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>;
    return <Badge className="bg-red-100 text-red-800">Low</Badge>;
  };

  const handleDeletePoster = async (poster) => {
    if (!poster.dbId) {
      toast.error("Cannot delete poster: No database record found");
      return;
    }
    try {
      setDeletingPoster(poster.dbId);
      const result = await fetch("/api/poster", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: poster.dbId,
          posterId: poster.id,
        }),
      });
      if (result.ok) {
        toast.success(`Poster ${poster.id} deleted successfully`);
        // Refresh the page to update the data
        window.location.reload();
      } else {
        toast.error(result.error || "Failed to delete poster");
      }
    } catch (error) {
      console.error("Error deleting poster:", error);
      toast.error("An error occurred while deleting the poster");
    } finally {
      setDeletingPoster(null);
    }
  };

  const handleToggleStatus = async (poster) => {
    if (!poster.dbId) {
      toast.error("Cannot update: no database record");
      return;
    }
    const next = poster.status === "done" ? "progressing" : "done";
    try {
      const res = await fetch("/api/poster", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: poster.dbId, status: next }),
      });
      if (res.ok) {
        toast.success(`Poster ${poster.id} marked ${next}`);
        window.location.reload();
      } else {
        toast.error("Failed to update status");
      }
    } catch (error) {
      console.error(error);
      toast.error("An error occurred while updating status");
    }
  };

  const handleMarkAllDone = async () => {
    try {
      const res = await fetch("/api/poster", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markAllDone" }),
      });
      if (res.ok) {
        toast.success("All progressing projects marked done");
        window.location.reload();
      } else {
        toast.error("Failed to mark all done");
      }
    } catch (error) {
      console.error(error);
      toast.error("An error occurred");
    }
  };

  const handleReset = async (poster) => {
    try {
      const res = await fetch("/api/poster", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset", posterId: poster.id }),
      });
      if (res.ok) {
        toast.success(`Poster ${poster.id} votes reset (old result archived)`);
        window.location.reload();
      } else {
        toast.error("Failed to reset votes");
      }
    } catch (error) {
      console.error(error);
      toast.error("An error occurred while resetting");
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Poster Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor your poster performance and voting statistics
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/history">History</Link>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline">Mark All Done</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>End the round?</AlertDialogTitle>
                <AlertDialogDescription>
                  All progressing projects become done and leave the homepage.
                  You can reopen them individually later.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleMarkAllDone}>
                  Mark All Done
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button asChild>
            <Link href="/dashboard/poster">
              <Plus className="mr-2 h-4 w-4" />
              Create New Poster
            </Link>
          </Button>
        </div>
      </div>

      <BannerCard currentBanner={banner} />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Posters</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPosters}</div>
            <p className="text-xs text-muted-foreground">
              Unique posters with votes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Yes Votes</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {totalYesVotes}
            </div>
            <p className="text-xs text-muted-foreground">Positive responses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">No Votes</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {totalNoVotes}
            </div>
            <p className="text-xs text-muted-foreground">Negative responses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvalRate}%</div>
            <p className="text-xs text-muted-foreground">Overall approval</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Poster List</CardTitle>
          <CardDescription>
            View and manage all your posters and their voting statistics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search posters..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdDate">First Vote Date</SelectItem>
                <SelectItem value="yesVotes">Yes Votes</SelectItem>
                <SelectItem value="totalVotes">Total Votes</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="progressing">Progressing</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Poster ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>First Vote Date</TableHead>
                  <TableHead className="text-center">Yes Votes</TableHead>
                  <TableHead className="text-center">Total Votes</TableHead>
                  <TableHead className="text-center">Approval Rate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPosters.map((poster) => {
                  const totalVotes = poster.yesVotes + poster.noVotes;
                  const approvalRate = Number.parseFloat(
                    getApprovalRate(poster.yesVotes, poster.noVotes)
                  );

                  return (
                    <TableRow key={poster.id}>
                      <TableCell className="font-medium">{poster.id}</TableCell>
                      <TableCell>{poster.title}</TableCell>
                      <TableCell>
                        {new Date(poster.createdDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                          {poster.yesVotes}
                        </span>
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {totalVotes}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-medium">{approvalRate}%</span>
                          {getApprovalBadge(approvalRate)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            poster.status === "progressing"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {poster.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                       <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!poster.dbId}
                          onClick={() => handleToggleStatus(poster)}
                        >
                          {poster.status === "done" ? "Reopen" : "Mark Done"}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={!poster.dbId}
                            >
                              Reset
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Reset votes?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Archive the current result and reset votes to
                                zero. Everyone can vote again on Poster{" "}
                                {poster.id}.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleReset(poster)}
                              >
                                Reset
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={
                                deletingPoster === poster.id || !poster.dbId
                              }
                            >
                              {deletingPoster === poster.id ? (
                                <Loader className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Poster</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete Poster{" "}
                                {poster.id}? This action cannot be undone and
                                will also delete all associated voting data.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeletePoster(poster)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete Poster
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                       </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {filteredPosters.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {posterData.length === 0
                  ? "No voting data available yet."
                  : "No posters found matching your criteria."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
