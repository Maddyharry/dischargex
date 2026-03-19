import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.redirect(new URL("/login?error=InvalidToken", req.url));
  }

  const user = await prisma.user.findFirst({
    where: { emailVerifyToken: token },
    select: { id: true, emailVerified: true },
  });

  if (!user) {
    return NextResponse.redirect(new URL("/login?error=InvalidToken", req.url));
  }

  if (!user.emailVerified) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        emailVerifyToken: null,
      },
    });
  }

  return NextResponse.redirect(new URL("/login?verified=1", req.url));
}
