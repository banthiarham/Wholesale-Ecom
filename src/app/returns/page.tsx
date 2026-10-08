import type { Metadata } from "next"
import PolicyPage from "@/components/layout/PolicyPage"
import { returnsPolicy } from "@/content/policies"

export const metadata: Metadata = {
  title: returnsPolicy.title,
  description: returnsPolicy.description,
  alternates: { canonical: "/returns" },
}

export default function Page() {
  return <PolicyPage doc={returnsPolicy} />
}
