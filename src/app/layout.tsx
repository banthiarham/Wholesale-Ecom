import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { LanguageProvider } from "@/lib/i18n/LanguageProvider"
import Header from "@/components/layout/Header"
import { Analytics } from "@/lib/analytics"

const inter = Inter({ subsets: ["latin"] })

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://wholesalex.com"

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "WholesaleX Pro — B2B Wholesale E-Commerce Platform",
    template: "%s | WholesaleX Pro",
  },
  description:
    "India's trusted B2B wholesale marketplace. Buy bulk products at the best prices with tier pricing, contract deals, and fast shipping across India.",
  keywords: [
    "wholesale",
    "B2B",
    "bulk order",
    "wholesale marketplace",
    "wholesale India",
    "bulk pricing",
    "business supplies",
    "wholesale electronics",
    "wholesale fashion",
    "industrial supplies",
  ],
  authors: [{ name: "WholesaleX Pro" }],
  creator: "WholesaleX Pro",
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: siteUrl,
    siteName: "WholesaleX Pro",
    title: "WholesaleX Pro — B2B Wholesale E-Commerce Platform",
    description:
      "India's trusted B2B wholesale marketplace. Buy bulk products at the best prices with tier pricing and fast shipping.",
  },
  twitter: {
    card: "summary_large_image",
    title: "WholesaleX Pro — B2B Wholesale E-Commerce Platform",
    description:
      "India's trusted B2B wholesale marketplace. Buy bulk products at the best prices.",
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
  alternates: {
    canonical: siteUrl,
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <LanguageProvider>
          <Header />
          {children}
        </LanguageProvider>
        <Analytics />
      </body>
    </html>
  )
}