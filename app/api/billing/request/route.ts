import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  void req;
  return NextResponse.json(
    {
      ok: false,
      error: "ระบบโอนสลิปแบบเดิมถูกปิดแล้ว กรุณาชำระผ่าน Stripe เท่านั้น",
    },
    { status: 410 }
  );
}

