import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClientProviders } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "DevSentinel - AI-Powered Code Intelligence",
    template: "%s | DevSentinel"
  },
  description: "Automated code analysis, bug detection, and autonomous fixes with AI. DevSentinel reads your PRD, tests your code, finds what's broken, and fixes it for you.",
  keywords: ["code analysis", "AI", "bug detection", "automated fixes", "GitHub", "code intelligence", "security audit", "PRD compliance"],
  authors: [{ name: "DevSentinel" }],
  creator: "DevSentinel",
  publisher: "DevSentinel",
  viewport: "width=device-width, initial-scale=1",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" }
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://devsentinel.com",
    siteName: "DevSentinel",
    title: "DevSentinel - AI-Powered Code Intelligence",
    description: "Automated code analysis, bug detection, and autonomous fixes with AI",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "DevSentinel - AI-Powered Code Intelligence",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DevSentinel - AI-Powered Code Intelligence",
    description: "Automated code analysis, bug detection, and autonomous fixes with AI",
    images: ["/og-image.png"],
    creator: "@devsentinel",
  },
  alternates: {
    canonical: "https://devsentinel.com",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
