import type { Metadata } from "next"
import Link from "next/link"
import { Phone, Mail, MapPin, HelpCircle, Truck } from "lucide-react"
import { contactDetails } from "@/content/contact"

export const metadata: Metadata = {
  title: "Contact Us",
  description: `Contact ${contactDetails.company}, Hanumangarh — call ${contactDetails.phoneDisplay} or email ${contactDetails.email}.`,
  alternates: { canonical: "/contact" },
}

const cardLink = "text-primary-600 font-semibold hover:text-primary-700 hover:underline break-words"

export default function ContactPage() {
  const cards = [
    {
      icon: Phone,
      title: "Call us",
      hint: "Talk to us about orders, pricing or your account.",
      value: contactDetails.phoneDisplay,
      href: contactDetails.phoneHref,
    },
    {
      icon: Mail,
      title: "Email us",
      hint: "Write to us and we will get back to you.",
      value: contactDetails.email,
      href: contactDetails.emailHref,
    },
    {
      icon: MapPin,
      title: "Our location",
      hint: "We serve partners all over India.",
      value: `${contactDetails.company}, ${contactDetails.city}`,
      href: null,
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50/50">
      <main className="section-container py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <span className="eyebrow">Get in touch</span>
            <h1 className="heading-lg">Contact Us</h1>
            <p className="body-sm mt-1">Have a question about a product, an order or your account? Reach out to {contactDetails.company} using any of the options below.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {cards.map(({ icon: Icon, title, hint, value, href }) => (
              <div key={title} className="card-base-static p-6 flex flex-col">
                <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center mb-4">
                  <Icon size={20} />
                </div>
                <h2 className="heading-sm">{title}</h2>
                <p className="text-sm text-gray-500 mt-1 mb-3">{hint}</p>
                {href ? (
                  <a href={href} className={`${cardLink} mt-auto text-sm`}>
                    {value.includes("@") ? (<>{value.split("@")[0]}@<wbr />{value.split("@")[1]}</>) : value}
                  </a>
                ) : (
                  <p className="mt-auto text-sm font-semibold text-gray-800">{value}</p>
                )}
              </div>
            ))}
          </div>

          <div className="card-base-static p-6 sm:p-8 mt-4">
            <h2 className="heading-sm mb-4">Before you contact us</h2>
            <ul className="space-y-3">
              <li className="flex gap-3 text-sm sm:text-[15px] text-gray-600 leading-relaxed">
                <HelpCircle size={18} className="text-primary-500 shrink-0 mt-0.5" />
                <span>
                  Many common questions about pricing, minimum quantities, payment, returns and warranty are answered on our{" "}
                  <Link href="/faq" className={cardLink}>FAQs page</Link>.
                </span>
              </li>
              <li className="flex gap-3 text-sm sm:text-[15px] text-gray-600 leading-relaxed">
                <Truck size={18} className="text-primary-500 shrink-0 mt-0.5" />
                <span>
                  If there is a problem in delivery, please contact the courier directly before contacting us. See our{" "}
                  <Link href="/shipping" className={cardLink}>Shipping Information</Link>.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}
