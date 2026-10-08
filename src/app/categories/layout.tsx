import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Product Categories",
  description:
    "Explore wholesale product categories — electronics, fashion, industrial supplies, and more. Bulk orders at the best prices.",
  openGraph: {
    title: "Product Categories — Wholesale Center",
    description:
      "Explore wholesale product categories — electronics, fashion, industrial supplies, and more.",
  },
}

export default function CategoriesLayout({ children }: { children: React.ReactNode }) {
  return children
}