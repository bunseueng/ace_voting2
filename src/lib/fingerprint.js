"use client";

// Self-contained browser fingerprint (no external service, no cost).
// Hashes only signals that stay the SAME across normal and incognito windows
// on the same device+browser — GPU/canvas render, screen, timezone, hardware,
// user agent. So opening incognito yields the same id => same voter => blocked.
// A genuinely different device or browser yields a different id (correct).
//
// This is a deterrent, not proof: browsers with anti-fingerprinting that
// randomize canvas (Brave, Firefox RFP) can still differ. Good enough to stop
// the common "just open incognito" trick for a casual event.

let cached;

async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function canvasSignal() {
  try {
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    if (!ctx) return "no-canvas";
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("ACE-vote-fp-\u{1F3A8}", 2, 15);
    ctx.fillStyle = "rgba(102,204,0,0.7)";
    ctx.fillText("ACE-vote-fp-\u{1F3A8}", 4, 17);
    return c.toDataURL();
  } catch {
    return "no-canvas";
  }
}

function webglSignal() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl") || c.getContext("experimental-webgl");
    if (!gl) return "no-webgl";
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const vendor = dbg
      ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)
      : gl.getParameter(gl.VENDOR);
    const renderer = dbg
      ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER);
    return `${vendor}/${renderer}`;
  } catch {
    return "no-webgl";
  }
}

export async function getVisitorId() {
  if (cached) return cached;
  try {
    const n = navigator;
    const s = window.screen;
    const signals = [
      n.userAgent || "",
      (n.languages || [n.language]).join(","),
      n.platform || "",
      n.hardwareConcurrency || "",
      n.deviceMemory || "",
      `${s.width}x${s.height}x${s.colorDepth}`,
      window.devicePixelRatio || "",
      Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      canvasSignal(),
      webglSignal(),
    ].join("|");
    cached = await sha256Hex(signals);
    return cached;
  } catch {
    return null;
  }
}
