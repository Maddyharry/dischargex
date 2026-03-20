import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.redirect(new URL("/login?error=InvalidToken", req.url));
  }

  const user = await prisma.user.findFirst({
    where: { emailVerifyToken: token },
    select: { id: true, email: true, emailVerified: true },
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

  const emailQuery = user.email ? `&email=${encodeURIComponent(user.email)}` : "";
  return NextResponse.redirect(new URL(`/login?verified=1${emailQuery}`, req.url));
}
