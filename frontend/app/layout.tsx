import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "UrbanFlow Valencia — Optimización de equipamientos urbanos",
    template: "%s · UrbanFlow Valencia",
  },
  description:
    "Plataforma de decisión para localizar equipamientos urbanos en Valencia: maximiza la cobertura de población bajo presupuesto con programación lineal entera (PuLP), usando demanda de tráfico predicha con CatBoost.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${inter.variable} ${plusJakarta.variable}`}>
      <body>
        <Navbar />
        <main className="mx-auto min-h-[calc(100vh-9rem)] max-w-[1440px] px-4 py-8 sm:px-8 sm:py-12">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
