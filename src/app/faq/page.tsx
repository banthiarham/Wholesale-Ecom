import type { Metadata } from "next"
import Link from "next/link"
import { ChevronDown } from "lucide-react"
import { faqGroups } from "@/content/faqs"
import { contactDetails } from "@/content/contact"

export const metadata: Metadata = {
  title: "FAQs",
  description:
    "Answers to common questions about ordering, wholesale pricing and minimum quantities, payment, shipping, returns and warranty at wholesalecenter.in.",
  alternates: { canonical: "/faq" },
}

export default function FaqPage() {
  // Structured data so search engines can show these as rich FAQ results.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqGroups.flatMap((g) =>
      g.items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      }))
    ),
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="section-container py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <span className="eyebrow">Help</span>
            <h1 className="heading-lg">Frequently Asked Questions</h1>
            <p className="body-sm mt-1">Quick answers about ordering, pricing, payment, shipping and returns.</p>
          </div>

          <div className="space-y-6">
            {faqGroups.map((group) => (
              <section key={group.title}>
                <h2 className="heading-sm mb-3">{group.title}</h2>
                <div className="card-base-static divide-y divide-gray-100 overflow-hidden">
                  {group.items.map((item) => (
                    <details key={item.q} className="group">
                      <summary className="flex items-center justify-between gap-4 px-5 sm:px-6 py-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:bg-gray-50/70 transition-colors">
                        <span className="text-sm sm:text-[15px] font-semibold text-gray-900">{item.q}</span>
                        <ChevronDown size={18} className="text-gray-400 shrink-0 transition-transform duration-200 group-open:rotate-180" />
                      </summary>
                      <p className="px-5 sm:px-6 pb-5 -mt-1 text-sm sm:text-[15px] text-gray-600 leading-relaxed">{item.a}</p>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="card-base-static p-6 sm:p-8 mt-8 text-center">
            <h2 className="heading-sm">Still have a question?</h2>
            <p className="text-sm text-gray-500 mt-1">Call {contactDetails.phoneDisplay} or email {contactDetails.email}.</p>
            <Link href="/contact" className="btn-primary text-sm py-2.5 px-6 mt-4 inline-flex items-center gap-2">Contact Us</Link>
          </div>
        </div>
      </main>
    </div>
  )
}
