import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Wholesale Products",
  description:
    "Browse our full catalog of wholesale products. Bulk pricing, tier discounts, and fast shipping across India.",
  openGraph: {
    title: "Wholesale Products — WholesaleX Pro",
    description:
      "Browse our full catalog of wholesale products. Bulk pricing, tier discounts, and fast shipping across India.",
  },
}

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return children
}