import { withAuth } from "next-auth/middleware";
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import { isChatEnabled } from "@/lib/feature-flags";

const CHAT_BLOCKED_PATH_PREFIXES = [
  "/chat",
  "/admin/chat",
  "/admin/opd-assist-lab",
  "/admin/opd-assist-logs",
  "/api/specialist-chat",
  "/api/chat-threads",
  "/api/chat-style",
  "/api/opd-assist",
  "/api/admin/chat",
  "/api/admin/chatbot-insights",
  "/api/admin/chatbot-reply",
  "/api/admin/chatbot-settings",
];

function isChatBlockedPath(pathname: string) {
  return CHAT_BLOCKED_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

const authMiddleware = withAuth(
  function middleware(req) {
    const pathname = req.nextUrl.pathname;

    if (!isChatEnabled() && isChatBlockedPath(pathname)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ ok: false, error: "Feature disabled" }, { status: 404 });
      }
      return NextResponse.redirect(new URL("/app", req.url));
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
        const pathname = req.nextUrl.pathname;

        // ปิด chat: ปล่อยผ่านมาให้ middleware() ด้านบนจัดการ 404/redirect เอง
        // ไม่ต้อง gate ด้วย login เพราะ route พวกนี้ควรหายไปเฉยๆ ไม่ใช่เด้งไปหน้า login
        if (!isChatEnabled() && isChatBlockedPath(pathname)) {
          return true;
        }

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

// Keep production closed until the release checklist is complete. Local and
// preview builds remain testable. Remove this constant only when reopening.
const PRODUCTION_MAINTENANCE = false;
export function middleware(req: NextRequest, event: NextFetchEvent) {
  const path = req.nextUrl.pathname;
  if (PRODUCTION_MAINTENANCE && process.env.VERCEL_ENV === "production" && path !== "/api/stripe/webhook") {
    const headers = { "Cache-Control": "no-store", "Retry-After": "3600" };
    if (path.startsWith("/api/")) return NextResponse.json({ error: "maintenance", message: "DischargeX กำลังปรับปรุงชั่วคราว กรุณาลองใหม่ภายหลัง" }, { status: 503, headers });
    return new NextResponse('<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DischargeX — กำลังปรับปรุง</title><body style="margin:0;background:#0f172a;color:#f1f5f9;font-family:Tahoma,sans-serif;display:grid;min-height:100vh;place-items:center"><main style="max-width:600px;padding:32px;text-align:center"><h1>Discharge<span style="color:#22d3ee">X</span></h1><h2>กำลังปรับปรุงระบบชั่วคราว</h2><p>กรุณากลับมาใหม่ภายหลัง ขอบคุณที่รอครับ</p></main></body></html>', { status: 503, headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } });
  }
  if (/^\/(?:app|admin|chat)(?:\/|$)/.test(path) || isChatBlockedPath(path)) {
    return authMiddleware(req as Parameters<typeof authMiddleware>[0], event);
  }
  return NextResponse.next();
}
export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
