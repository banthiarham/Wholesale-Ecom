import type { Metadata } from "next"
import PolicyPage from "@/components/layout/PolicyPage"
import { termsAndConditions } from "@/content/policies"

export const metadata: Metadata = {
  title: termsAndConditions.title,
  description: termsAndConditions.description,
  alternates: { canonical: "/terms" },
}

export default function Page() {
  return <PolicyPage doc={termsAndConditions} />
}
