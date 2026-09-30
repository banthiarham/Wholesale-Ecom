import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { policyDocs, type PolicyDoc } from "@/content/policies"

// Turns e-mail addresses inside policy text into mailto links; everything else stays plain text.
const EMAIL_RE = /([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g

function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(EMAIL_RE).map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} href={`mailto:${part}`} className="text-primary-600 font-medium hover:text-primary-700 hover:underline">
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

const bodyText = "text-sm sm:text-[15px] text-gray-600 leading-relaxed"

export default function PolicyPage({ doc }: { doc: PolicyDoc }) {
  const related = policyDocs.filter((d) => d.slug !== doc.slug)

  return (
    <div className="min-h-screen bg-gray-50/50">
      <main className="section-container py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <span className="eyebrow">{doc.eyebrow}</span>
            <h1 className="heading-lg">{doc.title}</h1>
          </div>

          <article className="card-base-static p-6 sm:p-8 space-y-8">
            {doc.intro && (
              <div className="space-y-4">
                {doc.intro.map((p, i) => (
                  <p key={i} className={i === 0 && doc.slug === "about" ? "text-base sm:text-lg text-gray-800 font-medium leading-relaxed" : bodyText}>
                    <RichText text={p} />
                  </p>
                ))}
              </div>
            )}

            {doc.sections.map((section, si) => (
              <section key={si} className={doc.intro || si > 0 ? "pt-8 border-t border-gray-100" : ""}>
                {section.heading && <h2 className="heading-sm mb-3">{section.heading}</h2>}

                {section.paragraphs && (
                  <div className="space-y-4">
                    {section.paragraphs.map((p, i) => (
                      <p key={i} className={bodyText}>
                        <RichText text={p} />
                      </p>
                    ))}
                  </div>
                )}

                {section.items && (
                  <ul className="space-y-3">
                    {section.items.map((item, i) => (
                      <li key={i} className={`flex gap-3 ${bodyText}`}>
                        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0" aria-hidden />
                        <span><RichText text={item} /></span>
                      </li>
                    ))}
                  </ul>
                )}

                {section.numbered && (
                  <ol className="space-y-3">
                    {section.numbered.map((item, i) => (
                      <li key={i} className={`flex gap-3 ${bodyText}`}>
                        <span className="w-6 h-6 rounded-full bg-primary-50 text-primary-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span><RichText text={item} /></span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            ))}
          </article>

          {/* Other policy pages */}
          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Also see</span>
            {related.map((d) => (
              <Link
                key={d.slug}
                href={`/${d.slug}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-100 rounded-full px-3.5 py-1.5 hover:text-primary-600 hover:border-primary-100 transition-colors"
              >
                {d.label} <ArrowRight size={13} />
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
