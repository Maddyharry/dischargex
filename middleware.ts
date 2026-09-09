import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export const middleware = withAuth(
  function middleware(req) {
    const pathname = req.nextUrl.pathname;
    // Temporary maintenance requested by the owner. Remove this gate to reopen.
    if (pathname !== "/api/stripe/webhook") {
      const headers = { "Cache-Control": "no-store", "Retry-After": "3600", "X-Robots-Tag": "noindex" };
      if (pathname.startsWith("/api/")) return NextResponse.json({ error: "maintenance", message: "DischargeX กำลังปรับปรุงชั่วคราว กรุณาลองใหม่ภายหลัง" }, { status: 503, headers });
      return new NextResponse('<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DischargeX — กำลังปรับปรุง</title><body style="margin:0;background:#0f172a;color:#f1f5f9;font-family:Tahoma,sans-serif;display:grid;min-height:100vh;place-items:center"><main style="max-width:600px;padding:32px;text-align:center"><h1>Discharge<span style="color:#22d3ee">X</span></h1><h2>กำลังปรับปรุงระบบชั่วคราว</h2><p>ขณะนี้ยังไม่สามารถเข้าสู่ระบบ สรุปชาร์จ หรือซื้อแพ็กเกจได้</p><p>กรุณากลับมาใหม่ภายหลัง ขอบคุณที่รอครับ</p></main></body></html>', { status: 503, headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } });
    }
    if (pathname.startsWith("/admin")) {
      const role = (req.nextauth.token as { role?: string } | null)?.role;
      if (role !== "admin") {
        const loginUrl = new URL("/login/admin", req.url);
        loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
        return NextResponse.redirect(loginUrl);
      }
    }
  },
  {
    pages: {
      signIn: "/login",
    },
    callbacks: {
      authorized: ({ token, req }) => {
        return true;
        const pathname = req.nextUrl.pathname;

        /** สรุปชาร์จแบบสาธิต (/app/guest) — ไม่ต้องล็อกอิน (tutorial + mock API) */
        if (pathname === "/app/guest" || pathname.startsWith("/app/guest/")) {
          return true;
        }

        if (!token) return false;

        if (pathname.startsWith("/admin")) return Boolean(token);

        // สำหรับ /app ให้แค่ต้องล็อกอินก็พอ
        return true;
      },
    },
  }
);

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};

