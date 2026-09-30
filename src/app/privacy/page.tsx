import type { Metadata } from "next"
import PolicyPage from "@/components/layout/PolicyPage"
import { privacyPolicy } from "@/content/policies"

export const metadata: Metadata = {
  title: privacyPolicy.title,
  description: privacyPolicy.description,
  alternates: { canonical: "/privacy" },
}

export default function Page() {
  return <PolicyPage doc={privacyPolicy} />
}
