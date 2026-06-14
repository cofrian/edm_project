import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "UrbanFlow Valencia",
  description:
    "Predicción de presión de tráfico urbano en Valencia y optimización de movilidad sostenible (EDM).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <Navbar />
        <main className="mx-auto min-h-[calc(100vh-8rem)] max-w-7xl px-4 py-8">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
