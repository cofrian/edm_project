import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
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
    <html lang="es" className={inter.variable}>
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
