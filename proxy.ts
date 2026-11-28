import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isClerkAuthActive, isClerkConfigured } from "@/lib/clerk/auth-mode";
import { safeClerkRedirectDestination } from "@/lib/clerk/safe-redirect-url";

const isAppRoute = createRouteMatcher(["/app(.*)"]);
const isClerkAuthRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

/**
 * Clerk protects `/app` when Clerk env is set.
 */
export default clerkMiddleware(
  async (auth, request: NextRequest) => {
    if (isClerkAuthActive()) {
      const { userId } = await auth();
      if (isClerkAuthRoute(request) && userId) {
        const next = request.nextUrl.searchParams.get("redirect_url");
        const dest = safeClerkRedirectDestination(
          request.url,
          next,
          "/app/explore",
        );
        return NextResponse.redirect(new URL(dest, request.url));
      }
      if (isAppRoute(request) && !userId) {
        const url = new URL("/sign-in", request.url);
        url.searchParams.set(
          "redirect_url",
          `${request.nextUrl.pathname}${request.nextUrl.search}`,
        );
        return NextResponse.redirect(url);
      }
    }

    if (!isClerkConfigured() && isAppRoute(request)) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next({ request });
  },
  { frontendApiProxy: { enabled: true } },
);

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
