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
    <section className="section-padding">
      <div className="section-container">
        <div className="bg-gray-50 rounded-3xl px-6 py-12 sm:px-12 sm:py-16 lg:px-16 lg:py-20 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-100 rounded-2xl mb-5">
            <Mail size={24} className="text-primary-600" />
          </div>
          <h2 className="heading-lg mb-3">Stay Updated</h2>
          <p className="body-lg max-w-md mx-auto mb-8">
            Get the latest deals, new arrivals, and exclusive wholesale offers delivered to your inbox.
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-3 max-w-lg mx-auto">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="input-base flex-1 w-full sm:w-auto"
              required
            />
            <button
              type="submit"
              className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto whitespace-nowrap"
            >
              {subscribed ? (
                <>✓ Subscribed!</>
              ) : (
                <>Subscribe <ArrowRight size={16} /></>
              )}
            </button>
          </form>
          <p className="text-xs text-gray-400 mt-4">No spam, unsubscribe anytime. We respect your privacy.</p>
        </div>
      </div>
    </section>
  )
}