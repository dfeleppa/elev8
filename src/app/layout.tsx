import type { Metadata, Viewport } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";

const fontHeading = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
});

const fontBody = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Lyfe Fitness",
  description: "Your gym management platform — training, nutrition, and performance.",
};

// viewportFit: "cover" is required for env(safe-area-inset-*) to resolve to
// non-zero values on notched iPhones — the shell and nutrition page pad with it.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeInitScript = `
    (function () {
      try {
        var storedTheme = window.localStorage.getItem("elev8-theme");
        var theme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : "light";
        document.documentElement.setAttribute("data-theme", theme);
      } catch (error) {
        document.documentElement.setAttribute("data-theme", "light");
      }
    })();
  `;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${fontHeading.variable} ${fontBody.variable} app-root antialiased`}>
        {children}
      </body>
    </html>
  );
}
