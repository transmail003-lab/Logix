import "./globals.css";
import type { Metadata } from "next";
import RegisterSW from "./register-sw";

export const metadata: Metadata = {
  title: "Logix — Trazabilidad de Última Milla",
  description: "Sistema de trazabilidad y gestión de última milla",
  manifest: "/manifest.json"
};

export const viewport = {
  themeColor: "#1d4ed8",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}
