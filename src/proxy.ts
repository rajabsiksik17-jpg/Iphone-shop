import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);

/**
 * Edge of the app: locale negotiation/redirects, plus a cheap gate that sends
 * signed-out visitors of /admin straight to the login page (real authorisation
 * still happens server-side on every request).
 */
export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const match = pathname.match(/^\/(ar|en)\/admin(\/.*)?$/);
  if (match) {
    const rest = match[2] ?? "";
    const isAuthPage = /^\/(login|forgot-password|reset-password|verify)(\/|$)/.test(rest);
    if (!isAuthPage && !req.cookies.get("nq_admin")) {
      const url = req.nextUrl.clone();
      url.pathname = `/${match[1]}/admin/login`;
      url.search = rest && rest !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
      return NextResponse.redirect(url);
    }
  }
  return intl(req);
}

export const config = {
  // Everything except API, media, Next internals and files with an extension.
  matcher: ["/((?!api|media|_next|_vercel|realtime|sitemap.xml|robots.txt|manifest.webmanifest|.*\\..*).*)"],
};
