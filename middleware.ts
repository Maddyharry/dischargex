import { withAuth } from "next-auth/middleware";

export const middleware = withAuth(
  function middleware() {
    // logic is handled in callbacks.authorized below
  },
  {
    pages: {
      signIn: "/login",
    },
    callbacks: {
      authorized: ({ token, req }) => {
        if (!token) return false;

        const pathname = req.nextUrl.pathname;

        if (pathname.startsWith("/admin")) {
          return (token as { role?: string } | null)?.role === "admin";
        }

        // สำหรับ /app ให้แค่ต้องล็อกอินก็พอ
        return true;
      },
    },
  }
);

export const config = {
  matcher: ["/app/:path*", "/admin", "/admin/:path*"],
};

