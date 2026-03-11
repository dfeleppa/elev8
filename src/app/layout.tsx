import type { Metadata } from "next";
import "./globals.css";

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
      <body className="antialiased bg-slate-950 text-slate-100">
        {children}
      </body>
    </html>
  );
}
