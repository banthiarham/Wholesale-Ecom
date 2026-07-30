"use client"

import { useState } from "react"
import { Mail, ArrowRight } from "lucide-react"

export default function NewsletterSection() {
  const [email, setEmail] = useState("")
  const [subscribed, setSubscribed] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (email) {
      console.log("Newsletter subscription:", email)
      setSubscribed(true)
      setEmail("")
      setTimeout(() => setSubscribed(false), 4000)
    }
  }

  return (
    <section className="section-padding-tight">
      <div className="section-container">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-50 via-white to-primary-50 border border-primary-100/60 px-6 py-12 sm:px-12 sm:py-14 lg:px-16 lg:py-16 text-center">
          {/* Decorative texture */}
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="absolute inset-0 opacity-[0.4]"
              style={{ backgroundImage: "radial-gradient(rgb(var(--color-primary-200)) 1px, transparent 1px)", backgroundSize: "26px 26px", maskImage: "radial-gradient(ellipse at center, black, transparent 70%)", WebkitMaskImage: "radial-gradient(ellipse at center, black, transparent 70%)" }}
            />
            <div className="absolute -top-24 -left-16 w-72 h-72 bg-primary-200/30 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -right-16 w-80 h-80 bg-primary-300/20 rounded-full blur-3xl" />
          </div>

          <div className="relative">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl mb-6 shadow-[0_8px_24px_-8px_rgba(2,84,129,0.25)] border border-primary-100">
              <Mail size={26} className="text-primary-600" />
            </div>
            <h2 className="heading-lg mb-3">Stay Updated</h2>
            <p className="body-lg max-w-md mx-auto mb-9">
              Get the latest deals, new arrivals, and exclusive wholesale offers delivered to your inbox.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-2 max-w-lg mx-auto p-1.5 sm:rounded-full bg-white border border-gray-200 shadow-[0_4px_16px_-4px_rgba(15,23,42,0.08)]">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your business email"
                className="flex-1 w-full sm:w-auto px-4 py-2.5 bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none rounded-full"
                required
              />
              <button
                type="submit"
                className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto whitespace-nowrap rounded-full"
              >
                {subscribed ? (
                  <>✓ Subscribed!</>
                ) : (
                  <>Subscribe <ArrowRight size={16} /></>
                )}
              </button>
            </form>
            <p className="text-xs text-gray-400 mt-5">No spam, unsubscribe anytime. We respect your privacy.</p>
          </div>
        </div>
      </div>
    </section>
  )
}