import type { Metadata } from "next"
import PolicyPage from "@/components/layout/PolicyPage"
import { aboutUs } from "@/content/policies"

export const metadata: Metadata = {
  title: aboutUs.title,
  description: aboutUs.description,
  alternates: { canonical: "/about" },
}

export default function Page() {
  return <PolicyPage doc={aboutUs} />
}
