import { Loader } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader className="h-8 w-8 animate-spin text-blue-600" />
    </div>
  );
}
