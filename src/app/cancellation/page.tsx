import type { Metadata } from "next"
import PolicyPage from "@/components/layout/PolicyPage"
import { cancellationPolicy } from "@/content/policies"

export const metadata: Metadata = {
  title: cancellationPolicy.title,
  description: cancellationPolicy.description,
  alternates: { canonical: "/cancellation" },
}

export default function Page() {
  return <PolicyPage doc={cancellationPolicy} />
}
