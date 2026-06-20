"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader, AlertCircle, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const CreatePoster = ({ userId }) => {
  const [posterId, setPosterId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Reset states
    setError(null);
    setSuccess(false);

    // Validate input
    if (!posterId.trim()) {
      setError("Please enter a poster ID");
      return;
    }

    try {
      setIsSubmitting(true);

      // Simulate API call

      await new Promise((resolve) => setTimeout(resolve, 1500));
      const res = await fetch("/api/poster", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          posterId,
        }),
      });

      if (!res.ok) {
        toast.error("Unauthorized");
        setSuccess(false);
      } else {
        setSuccess(true);
        toast.success("Your poster has been created successfully!");
        router.refresh();
      }

      // Simulate successful poster creation

      // Reset form after success
      setPosterId("");

      // Optional: redirect after a delay
      // setTimeout(() => router.push(`/posters/${posterId}`), 2000)
    } catch (err) {
      setError("Failed to create poster. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Create Poster</CardTitle>
            <CardDescription>
              Enter a poster ID to create a new job poster
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="bg-green-50 text-green-800 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle>Success</AlertTitle>
                  <AlertDescription>
                    Your poster has been created successfully!
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="poster-id">Poster ID</Label>
                <Input
                  id="poster-id"
                  placeholder="Enter poster ID"
                  value={posterId}
                  onChange={(e) => setPosterId(e.target.value)}
                />
              </div>
            </CardContent>

            <CardFooter>
              <Button
                type="submit"
                className="w-full mt-5"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Poster"
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default CreatePoster;
