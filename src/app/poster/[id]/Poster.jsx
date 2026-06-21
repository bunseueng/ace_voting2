"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "../../../../@/components/ui/button";
import { toast } from "sonner";
import { Loader } from "lucide-react";
import { getVisitorId } from "@/lib/fingerprint";

const Poster = ({ posterId, closed, banner, title, alreadyVoted }) => {
  const [choice, setChoice] = useState("");
  const [loading, setLoading] = useState(false);
  // Voted before this visit (server/fingerprint-detected) vs. just voted now.
  const [alreadyVotedBefore, setAlreadyVotedBefore] = useState(alreadyVoted);
  const [justVoted, setJustVoted] = useState(false);
  const fpRef = useRef(null);
  const voted = alreadyVotedBefore || justVoted;

  // Compute the browser fingerprint once, then ask the server whether this
  // fingerprint already voted (catches incognito / cleared-cookie reuse that
  // the cookie-based server check on the page misses).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fp = await getVisitorId();
      if (cancelled) return;
      fpRef.current = fp;
      if (!fp || closed) return;
      try {
        const res = await fetch("/api/voting/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ posterId, fp }),
        });
        const data = await res.json();
        if (!cancelled && data?.voted) setAlreadyVotedBefore(true);
      } catch {
        // non-fatal: fall back to whatever the server cookie check decided
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [posterId, closed]);

  const handleVote = async () => {
    try {
      setLoading(true);
      if (!choice) {
        alert("Please select Yes or No before submitting.");
        return;
      }

      const res = await fetch("/api/voting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posterId, choice, fp: fpRef.current }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Treat an already-voted response as a permanent prior-vote state.
        if (res.status === 400 && /already voted/i.test(data.message || "")) {
          setAlreadyVotedBefore(true);
        }
        toast.error(data.message || "Vote failed.");
      } else {
        setJustVoted(true);
        toast.success("Thank you for voting!");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-screen-xl mx-auto px-4 md:px-2 lg:px-0">
      <img
        src={banner || "/banner.jfif"}
        alt="Voting banner"
        className="w-full h-full object-cover bg-center"
      />
      <div className="mt-10">
        <h1 className="font-bold text-2xl">{title}</h1>

        <div className="w-full h-full">
          {/* Voting options */}
          <div className="px-4 py-5 rounded-lg border border-slate-400 mt-5">
            <h1 className="text-xl font-bold mb-4">
              ខ្ញុំចូលចិត្តស្នាដៃរបស់សិស្សក្រុមទី {posterId}
            </h1>
            <h1 className="text-xl font-bold mb-4">
              I like the poster of group {posterId}
            </h1>
            {closed ? (
              <p className="text-red-500 font-semibold">
                Voting is closed for this project.
              </p>
            ) : (
              <div className="flex flex-col items-start space-y-2">
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="Yes"
                    name="vote"
                    value="Yes"
                    checked={choice === "Yes"}
                    disabled={voted}
                    className="disabled:cursor-not-allowed"
                    onChange={(e) => setChoice(e.target.value)}
                  />
                  <label htmlFor="Yes" className="pl-2">
                    Yes
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="No"
                    name="vote"
                    value="No"
                    checked={choice === "No"}
                    disabled={voted}
                    className="disabled:cursor-not-allowed"
                    onChange={(e) => setChoice(e.target.value)}
                  />
                  <label htmlFor="No" className="pl-2">
                    No
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          {!closed && (
            <div className="mt-6 flex items-center gap-3">
              <Button
                onClick={handleVote}
                disabled={loading || voted}
                className="disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit"
                )}
              </Button>
              {justVoted ? (
                <span className="text-green-600 font-semibold text-sm">
                  Thank you — your vote was recorded.
                </span>
              ) : (
                alreadyVotedBefore && (
                  <span className="text-red-500 font-semibold text-sm">
                    You already voted on this poster.
                  </span>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Poster;
