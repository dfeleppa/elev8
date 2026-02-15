import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const brandSans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-brand-sans",
});

const brandMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-brand-mono",
});

export const metadata: Metadata = {
  title: "Elev8 Control Center",
  description: "Personal operating system for focus, tasks, and rituals",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${brandSans.variable} ${brandMono.variable} antialiased bg-slate-950 text-slate-100`}
      >
        {children}
      </body>
    </html>
  );
}
