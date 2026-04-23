import { prisma } from "@/lib/prisma";

export async function trackTelemetry(params: {
  userId?: string | null;
  event: string;
  source: "chat" | "summary" | "web";
  payload?: Record<string, unknown>;
}) {
  try {
    await prisma.feedback.create({
      data: {
        userId: params.userId ?? undefined,
        type: "telemetry",
        message: `${params.source}:${params.event}`,
        payload: params.payload ? JSON.stringify(params.payload) : undefined,
        category: "other",
        shortSummary: `${params.source}:${params.event}`.slice(0, 180),
        status: "pending",
      },
    });
  } catch (err) {
    console.error("trackTelemetry failed:", err);
  }
}

