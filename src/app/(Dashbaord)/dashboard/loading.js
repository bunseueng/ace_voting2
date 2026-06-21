import { Loader } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3">
      <Loader className="h-8 w-8 animate-spin text-blue-600" />
      <p className="text-sm text-muted-foreground">Loading dashboard…</p>
    </div>
  );
}
