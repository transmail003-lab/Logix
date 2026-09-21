import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// Mapa único: rol en Supabase -> panel al que se redirige.
// Aquí vive TODA la lógica de "login inteligente"; no hay selección manual en la UI.
const ROLE_HOME: Record<string, string> = {
  admin: "/admin",
  coordinador: "/coordinador",
  bodega: "/bodega",
  motorista: "/motorista"
};

const PUBLIC_PATHS = ["/login", "/auth/callback"];

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: "", ...options });
        }
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  // No autenticado y pidiendo una ruta protegida -> a login
  if (!user && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user) {
    // Consulta el rol asignado en la base de datos (tabla profiles)
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, active")
      .eq("id", user.id)
      .single();

    const role = profile?.role ?? "motorista";
    const home = ROLE_HOME[role] ?? "/motorista";

    if (profile?.active === false) {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/login?disabled=1", request.url));
    }

    // Autenticado y en /login o / -> redirige automáticamente a SU panel
    if (path === "/login" || path === "/") {
      return NextResponse.redirect(new URL(home, request.url));
    }

    // Autenticado pero intentando entrar al panel de OTRO rol -> lo regresa al suyo
    const attemptedSection = "/" + path.split("/")[1];
    const sectionOwners = Object.values(ROLE_HOME);
    if (sectionOwners.includes(attemptedSection) && attemptedSection !== home) {
      return NextResponse.redirect(new URL(home, request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons).*)"]
};
