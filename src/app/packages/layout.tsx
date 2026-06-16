import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Product Packages — WholesaleX Pro",
  description: "Configure your perfect product package. Choose components, get exclusive discounts, and build exactly what you need.",
  openGraph: {
    title: "Product Packages — WholesaleX Pro",
    description: "Configure your perfect product package. Choose components, get exclusive discounts, and build exactly what you need.",
  },
}

export default function PackagesLayout({ children }: { children: React.ReactNode }) {
  return children
}