import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Account Details",
  description: "Bank account details for paying your Wholesale Center order by bank transfer.",
  alternates: { canonical: "/account-details" },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
