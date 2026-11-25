import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

const siteUrl =
  process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "ClearCut",
  description:
    "Enter. Cut. Leave. Instant batch AI background removal running privately in your browser.",
  openGraph: {
    title: "ClearCut — Enter. Cut. Leave.",
    description:
      "Instant batch AI background removal directly in your browser. Zero uploads, zero waiting.",
    siteName: "ClearCut",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ClearCut — Enter. Cut. Leave.",
    description:
      "Instant batch AI background removal directly in your browser. Zero uploads, zero waiting.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
