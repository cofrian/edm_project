import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { AppShell } from "@/components/AppShell";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "UrbanFlow Valencia — Consola de planificación urbana",
    template: "%s · UrbanFlow Valencia",
  },
  description:
    "Consola municipal para explorar Valencia en mapa, optimizar Valenbisi y equipamientos públicos con datos reales y modelos de cobertura.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={jakarta.variable}>
      <body className="overflow-hidden">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
