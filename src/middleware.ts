import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, verifyToken } from "@/lib/auth";

// Rotas abertas (sem login por cookie). O resto exige sessão; páginas checam também o usuário no banco.
const PUBLIC = ["/login", "/cadastro", "/redefinir", "/privacidade", "/api/cron"];
// ícones do site (favicon, ícone do iPhone): sempre públicos
const ICON = /^\/(icon|apple-icon)[^/]*\.(png|svg|ico)$/;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (ICON.test(pathname) || PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  if (await verifyToken(req.cookies.get(COOKIE)?.value)) return NextResponse.next();
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
