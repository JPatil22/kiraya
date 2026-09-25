import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.kirayah.xyz";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Kiraya — Verified Zero-Brokerage Rentals & Flatmates in Pune",
    template: "%s | Kiraya",
  },
  description:
    "Kiraya is Pune's trusted zero-brokerage rental platform. Browse verified 1BHK, 2BHK, 3BHK flats and direct flatmate listings across Wakad, Baner, Hinjewadi, and Kharadi. No ghost listings, no broker spam, 100% physically verified availability.",
  keywords: [
    "Kiraya",
    "Kiraya Pune",
    "Zero brokerage flats Pune",
    "Direct owner flats Wakad",
    "Baner apartments for rent",
    "Hinjewadi IT park rentals",
    "Kharadi flatmates",
    "Verified rentals Pune",
    "No broker rent Pune",
  ],
  authors: [{ name: "Kiraya Team" }],
  creator: "Kiraya",
  publisher: "Kiraya",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: siteUrl,
    siteName: "Kiraya",
    title: "Kiraya — Verified Zero-Brokerage Rentals & Flatmates in Pune",
    description:
      "Find verified 1BHK, 2BHK, 3BHK flats and direct flatmate listings in Pune tech hubs. Strictly zero brokerage, physically inspected properties.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kiraya — Verified Zero-Brokerage Rentals in Pune",
    description:
      "Find verified 1BHK, 2BHK, 3BHK flats and direct flatmate listings in Pune. Strictly zero brokerage.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "RealEstateAgent",
  name: "Kiraya",
  url: siteUrl,
  logo: `${siteUrl}/images/hero-apartment.jpg`,
  description:
    "Kiraya is a tenant-first zero-brokerage rental platform operating in Pune, India. Connecting working professionals directly with verified owners and shared flatmates in Wakad, Baner, Hinjewadi, and Kharadi.",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Pune",
    addressRegion: "Maharashtra",
    addressCountry: "IN",
  },
  areaServed: ["Wakad", "Baner", "Hinjewadi", "Kharadi", "Kothrud", "Pune"],
  priceRange: "₹₹",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={fontSans.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={cn(
          "min-h-dvh bg-background font-sans antialiased",
          "selection:bg-primary/10",
        )}
      >
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
