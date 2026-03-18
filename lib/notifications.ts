import { prisma } from "./prisma";

export async function notifyUser(params: {
  userId: string;
  type: "bonus" | "feedback" | "billing" | "system";
  title: string;
  message: string;
  meta?: unknown;
}) {
  await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      meta: params.meta != null ? JSON.stringify(params.meta) : null,
    },
  });
}

