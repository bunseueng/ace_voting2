"use client";

import FingerprintJS from "@fingerprintjs/fingerprintjs";

let cached;

// Returns a stable per-browser visitor id from the FingerprintJS open-source
// agent (many signals, smarter than a hand-rolled hash). Same physical browser
// tends to yield the same id across sessions and after clearing cookies.
//
// Honest limit: private/incognito mode randomizes some signals (canvas, etc.)
// on modern browsers, so a determined user can still get a fresh id. This is a
// deterrent, not a guarantee. Returns null if the agent fails to load.
export async function getVisitorId() {
  if (cached) return cached;
  try {
    const fp = await FingerprintJS.load();
    const { visitorId } = await fp.get();
    cached = visitorId;
    return visitorId;
  } catch {
    return null;
  }
}
