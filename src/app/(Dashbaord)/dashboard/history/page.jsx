import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import Navbar from "@/app/Component/Navbar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const HistoryPage = async () => {
  const session = await auth();
  if (!session?.user?.name) {
    return (
      <>
        <Navbar />
        <div className="text-center mt-20 text-red-500 text-xl font-semibold">
          You&apos;re not authorized to view this page.
        </div>
      </>
    );
  }

  const archives = await prisma.resultArchive.findMany({
    orderBy: { archivedAt: "desc" },
  });

  return (
    <>
      <Navbar />
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold mb-6">Archived Results</h1>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Poster ID</TableHead>
                <TableHead className="text-center">Yes</TableHead>
                <TableHead className="text-center">No</TableHead>
                <TableHead className="text-center">Total</TableHead>
                <TableHead>Archived</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {archives.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.posterId}</TableCell>
                  <TableCell className="text-center">{a.yesVotes}</TableCell>
                  <TableCell className="text-center">{a.noVotes}</TableCell>
                  <TableCell className="text-center">
                    {a.yesVotes + a.noVotes}
                  </TableCell>
                  <TableCell>
                    {new Date(a.archivedAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {archives.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            No archived results yet.
          </p>
        )}
      </div>
    </>
  );
};

export default HistoryPage;
