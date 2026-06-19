import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "UrbanFlow Valencia — Planificación urbana inteligente",
    template: "%s · UrbanFlow Valencia",
  },
  description:
    "Herramienta municipal para explorar Valencia en mapas con capas, optimizar Valenbisi y equipamientos públicos, y planificar inversiones con datos reales y modelos de cobertura.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={jakarta.variable}>
      <body>
        <Navbar />
        <main className="mx-auto min-h-[calc(100vh-9rem)] max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
