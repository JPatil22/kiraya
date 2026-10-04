import type { Metadata, Viewport } from "next";
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

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#4F46E5" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0F19" },
  ],
  width: "device-width",
  initialScale: 1,
};

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
  applicationName: "Kiraya",
  authors: [{ name: "Kiraya Team" }],
  creator: "Kiraya",
  publisher: "Kiraya",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48 32x32 16x16", type: "image/x-icon" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
  manifest: "/site.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kiraya",
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
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: "Kiraya",
      alternateName: ["Kirayah", "किराया", "Kiraya Pune", "Kirayah Pune"],
      url: siteUrl,
      description:
        "Tenant-first zero-brokerage rental platform in Pune. Verified flats and direct flatmates.",
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${siteUrl}/listings?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "RealEstateAgent",
      "@id": `${siteUrl}/#organization`,
      name: "Kiraya",
      alternateName: ["Kirayah", "किराया"],
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
      areaServed: [
        "Wakad",
        "Baner",
        "Hinjewadi",
        "Kharadi",
        "Kothrud",
        "Viman Nagar",
        "Aundh",
        "Balewadi",
        "Magarpatta",
        "Hadapsar",
        "Pimple Saudagar",
        "Pune",
      ],
      priceRange: "₹₹",
    },
    {
      "@type": "ItemList",
      "@id": `${siteUrl}/#navigation`,
      name: "Main Sitelinks Navigation",
      itemListElement: [
        {
          "@type": "SiteNavigationElement",
          position: 1,
          name: "Kiraya Direct (₹0 Brokerage)",
          description:
            "Peer-to-peer flatmates and verified owner rentals for working professionals.",
          url: `${siteUrl}/direct`,
        },
        {
          "@type": "SiteNavigationElement",
          position: 2,
          name: "Verified Rentals in Pune",
          description:
            "Browse physically verified 1BHK, 2BHK, and 3BHK rental apartments in Pune.",
          url: `${siteUrl}/listings`,
        },
        {
          "@type": "SiteNavigationElement",
          position: 3,
          name: "Flats for Rent in Wakad",
          description:
            "Verified zero-brokerage apartments and direct owner flats in Wakad, Pune.",
          url: `${siteUrl}/rent/pune/wakad`,
        },
        {
          "@type": "SiteNavigationElement",
          position: 4,
          name: "Flats for Rent in Baner",
          description:
            "Verified zero-brokerage flats and rental homes in Baner, Pune.",
          url: `${siteUrl}/rent/pune/baner`,
        },
        {
          "@type": "SiteNavigationElement",
          position: 5,
          name: "Flats for Rent in Hinjewadi",
          description:
            "Verified flats near Hinjewadi Phase 1, 2, and 3 IT parks.",
          url: `${siteUrl}/rent/pune/hinjewadi`,
        },
        {
          "@type": "SiteNavigationElement",
          position: 6,
          name: "Flats for Rent in Kharadi",
          description:
            "Verified rental apartments and shared flats in Kharadi, Pune.",
          url: `${siteUrl}/rent/pune/kharadi`,
        },
      ],
    },
  ],
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
