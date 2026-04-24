import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export const middleware = withAuth(
  function middleware(req) {
    const pathname = req.nextUrl.pathname;
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
  matcher: ["/app/:path*", "/admin", "/admin/:path*"],
};

