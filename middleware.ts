import { NextResponse, type NextRequest } from "next/server";

// Temporary owner-requested maintenance. Original auth middleware remains in
// Git history at cd2c41391070e2683ecc09189a7780ad3f57e586. Restore when reopening.
export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === "/api/stripe/webhook") return NextResponse.next();
  const headers = { "Cache-Control": "no-store", "Retry-After": "3600" };
  if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.json(
    { error: "maintenance", message: "DischargeX กำลังปรับปรุงชั่วคราว กรุณาลองใหม่ภายหลัง" },
    { status: 503, headers }
  );
  return new NextResponse('<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DischargeX — กำลังปรับปรุง</title><body style="margin:0;background:#0f172a;color:#f1f5f9;font-family:Tahoma,sans-serif;display:grid;min-height:100vh;place-items:center"><main style="max-width:600px;padding:32px;text-align:center"><h1>Discharge<span style="color:#22d3ee">X</span></h1><h2>กำลังปรับปรุงระบบชั่วคราว</h2><p>ขณะนี้ยังไม่สามารถเข้าสู่ระบบ สรุปชาร์จ หรือซื้อแพ็กเกจได้</p><p>กรุณากลับมาใหม่ภายหลัง ขอบคุณที่รอครับ</p></main></body></html>',
    { status: 503, headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } });
}
export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
