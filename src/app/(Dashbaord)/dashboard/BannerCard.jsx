"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader } from "lucide-react";
import { toast } from "sonner";

export default function BannerCard({ currentBanner }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!file) {
      toast.error("Choose an image first");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/banner", { method: "POST", body: form });
      if (res.ok) {
        toast.success("Banner updated");
        window.location.reload();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || "Upload failed");
      }
    } catch (err) {
      console.error(err);
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Homepage Banner</CardTitle>
        <CardDescription>Upload an image to replace the banner.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentBanner && (
          <img
            src={currentBanner}
            alt="Current banner"
            className="w-full max-h-40 object-cover rounded border"
          />
        )}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <Button onClick={handleUpload} disabled={uploading}>
          {uploading ? (
            <>
              <Loader className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            "Upload Banner"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
