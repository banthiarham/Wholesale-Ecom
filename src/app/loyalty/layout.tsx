import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Loyalty Program",
  robots: { index: false, follow: false },
}

export default function LoyaltyLayout({ children }: { children: React.ReactNode }) {
  return children
}