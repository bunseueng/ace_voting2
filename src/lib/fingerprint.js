"use client";

import FingerprintJS from "@fingerprintjs/fingerprintjs";

let cached;

// Returns a stable per-browser visitor id. The same physical browser yields the
// same id across normal AND incognito sessions and after clearing cookies, so it
// is far harder to bypass than a random cookie. Returns null if fingerprinting
// is blocked (e.g. privacy extension) — callers fall back to the cookie id.
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
