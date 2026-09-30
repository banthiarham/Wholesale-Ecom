import type { Metadata } from "next"
import PolicyPage from "@/components/layout/PolicyPage"
import { shippingInformation } from "@/content/policies"

export const metadata: Metadata = {
  title: shippingInformation.title,
  description: shippingInformation.description,
  alternates: { canonical: "/shipping" },
}

export default function Page() {
  return <PolicyPage doc={shippingInformation} />
}
