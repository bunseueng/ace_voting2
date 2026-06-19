import prisma from "@/lib/prisma";

/**
 * Fixed-window rate limiter backed by Mongo (works across instances).
 * Returns true if the request is allowed, false if the limit is exceeded.
 */
export async function rateLimit(key, { max = 20, windowMs = 60_000 } = {}) {
  const now = Date.now();
  const existing = await prisma.rateLimit.findUnique({ where: { key } });

  // No record or expired window -> reset
  if (!existing || existing.expiresAt.getTime() < now) {
    await prisma.rateLimit.upsert({
      where: { key },
      update: { count: 1, expiresAt: new Date(now + windowMs) },
      create: { key, count: 1, expiresAt: new Date(now + windowMs) },
    });
    return true;
  }

  if (existing.count >= max) return false;

  await prisma.rateLimit.update({
    where: { key },
    data: { count: { increment: 1 } },
  });
  return true;
}

/** Best-effort client IP from proxy headers. */
export function getClientIp(request) {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}
