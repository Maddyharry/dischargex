import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_CHAT_STYLE_PROFILE,
  getUserChatStyleProfile,
  mergeChatStyleProfile,
  setUserChatStyleProfile,
  type ChatStyleProfile,
} from "@/lib/chat-style-profile";

async function getCurrentUserId() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return null;
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  return user?.id || null;
}

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ ok: true, profile: DEFAULT_CHAT_STYLE_PROFILE, isGuest: true });
  }
  const profile = await getUserChatStyleProfile(userId);
  return NextResponse.json({ ok: true, profile });
}

export async function PATCH(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = (await req.json()) as { profile?: Partial<ChatStyleProfile> };
  const current = await getUserChatStyleProfile(userId);
  const merged = mergeChatStyleProfile(current, body.profile || {});
  const profile = await setUserChatStyleProfile(userId, merged);
  return NextResponse.json({ ok: true, profile });
}

