import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import localFont from "next/font/local";
import "./globals.css";
import "./fonts/font-classes.css";

const dmSans = localFont({
  src: "./fonts/DMSans-VariableFont_opsz,wght.ttf",
  variable: "--font-dm-sans",
  weight: "100 900",
  style: "normal",
  display: "swap",
});

const parisienne = localFont({
  src: "./fonts/Parisienne-Regular.ttf",
  variable: "--font-parisienne",
  weight: "400",
  style: "normal",
  display: "swap",
});

const ultra = localFont({
  src: "./fonts/Ultra-Regular.ttf",
  variable: "--font-ultra",
  weight: "400",
  style: "normal",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CarePilot — Cuidamos juntos",
  description:
    "Convierte necesidades de cuidado en planes compartidos, responsabilidades claras y presupuestos revisados por tu familia.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${dmSans.variable} ${parisienne.variable} ${ultra.variable}`} suppressHydrationWarning>
      <body className="font-dm-sans antialiased min-h-screen bg-background">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
