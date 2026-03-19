import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getChatbotKnowledge, setChatbotKnowledge } from "@/lib/chatbot-settings";

function isAdmin(session: unknown) {
  return (session as { user?: { role?: string } } | null)?.user?.role === "admin";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const knowledge = await getChatbotKnowledge();
  return NextResponse.json({ ok: true, knowledge });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const body = (await req.json()) as { knowledge?: string };
  if (typeof body.knowledge !== "string" || body.knowledge.trim().length === 0) {
    return NextResponse.json({ ok: false, error: "knowledge is required" }, { status: 400 });
  }
  await setChatbotKnowledge(body.knowledge);
  return NextResponse.json({ ok: true });
}
