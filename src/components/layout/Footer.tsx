"use client"

import { useState } from "react"
import Link from "next/link"
import { Package, Mail, Phone, Facebook, Twitter, Instagram, Linkedin, Send, CreditCard, Truck, Shield, RefreshCw } from "lucide-react"
import { useSetting } from "@/lib/settings/SiteSettingsProvider"

const quickLinks = [
  { label: "Home", href: "/" },
  { label: "Products", href: "/products" },
  { label: "Categories", href: "/categories" },
  { label: "Packages", href: "/packages" },
]

const supportLinks = [
  { label: "Contact Us", href: "/contact" },
  { label: "Shipping Policy", href: "/shipping" },
  { label: "FAQs", href: "/faq" },
]

const policyLinks = [
  { label: "Returns & Refunds", href: "/returns" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Cancellation Policy", href: "/cancellation" },
]

export default function Footer() {
  const siteName = useSetting("siteName", "WholesaleX Pro")
  const logoUrl = useSetting("logoUrl", "")
  const contactEmail = useSetting("contactEmail", "")
  const contactPhone = useSetting("contactPhone", "")
  const copyrightText = useSetting("copyrightText", "WholesaleX Pro. All rights reserved.")
  const socialLinksRaw = useSetting("socialLinks", '{"facebook":"","twitter":"","instagram":"","linkedin":""}')

  let socialLinks: Record<string, string> = { facebook: "", twitter: "", instagram: "", linkedin: "" }
  try { socialLinks = JSON.parse(socialLinksRaw) } catch {}

  const [email, setEmail] = useState("")
  const [subscribed, setSubscribed] = useState(false)

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault()
    if (email) {
      console.log("Newsletter subscription:", email)
      setSubscribed(true)
      setEmail("")
      setTimeout(() => setSubscribed(false), 3000)
    }
  }

  const socialIcons = [
    { key: "facebook", icon: Facebook, label: "Facebook" },
    { key: "twitter", icon: Twitter, label: "Twitter" },
    { key: "instagram", icon: Instagram, label: "Instagram" },
    { key: "linkedin", icon: Linkedin, label: "LinkedIn" },
  ]

  const currentYear = new Date().getFullYear()

  return (
    <footer className="relative bg-gray-900 text-gray-400">
      {/* Brand accent line */}
      <div className="h-[3px] bg-gradient-to-r from-primary-700 via-primary-400 to-primary-700" />

      {/* Main footer content — dense multi-column layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 lg:pt-12 pb-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8 lg:gap-6">
          {/* Column 1 — Brand */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              {logoUrl ? (
                <img src={logoUrl} alt={siteName} className="h-8 w-auto object-contain brightness-0 invert" />
              ) : (
                <>
                  <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center shadow-[0_4px_12px_-2px_rgba(3,105,161,0.5)]">
                    <Package size={17} className="text-white" />
                  </div>
                  <span className="text-lg font-bold text-white tracking-tight">{siteName}</span>
                </>
              )}
            </Link>
            <p className="text-xs leading-relaxed mb-4 max-w-xs">
              India&apos;s trusted B2B wholesale marketplace. Bulk orders, best prices, fast delivery.
            </p>
            <div className="flex items-center gap-2">
              {socialIcons.map(({ key, icon: Icon, label }) =>
                socialLinks[key] ? (
                  <a
                    key={key}
                    href={socialLinks[key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-md bg-white/10 flex items-center justify-center hover:bg-primary-600 hover:text-white transition-all duration-200"
                    aria-label={label}
                  >
                    <Icon size={14} />
                  </a>
                ) : (
                  <div
                    key={key}
                    className="w-8 h-8 rounded-md bg-white/5 flex items-center justify-center opacity-30"
                    aria-label={label}
                  >
                    <Icon size={14} />
                  </div>
                )
              )}
            </div>
          </div>

          {/* Column 2 — Quick Links */}
          <div>
            <h3 className="text-white font-bold text-[11px] uppercase tracking-widest mb-4">Quick Links</h3>
            <ul className="space-y-2.5">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-[13px] hover:text-white transition-colors duration-200">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3 — Help */}
          <div>
            <h3 className="text-white font-bold text-[11px] uppercase tracking-widest mb-4">Help</h3>
            <ul className="space-y-2.5">
              {supportLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-[13px] hover:text-white transition-colors duration-200">
                    {link.label}
                  </Link>
                </li>
              ))}
              {contactEmail && (
                <li>
                  <a href={`mailto:${contactEmail}`} className="text-[13px] hover:text-white transition-colors duration-200 flex items-center gap-1.5">
                    <Mail size={12} className="text-primary-500 shrink-0" />
                    <span className="truncate">{contactEmail}</span>
                  </a>
                </li>
              )}
              {contactPhone && (
                <li>
                  <a href={`tel:${contactPhone}`} className="text-[13px] hover:text-white transition-colors duration-200 flex items-center gap-1.5">
                    <Phone size={12} className="text-primary-500 shrink-0" />
                    {contactPhone}
                  </a>
                </li>
              )}
            </ul>
          </div>

          {/* Column 4 — Consumer Policy */}
          <div>
            <h3 className="text-white font-bold text-[11px] uppercase tracking-widest mb-4">Consumer Policy</h3>
            <ul className="space-y-2.5">
              {policyLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-[13px] hover:text-white transition-colors duration-200">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 5 — Newsletter */}
          <div className="col-span-2 sm:col-span-1">
            <h3 className="text-white font-bold text-[11px] uppercase tracking-widest mb-4">Stay Updated</h3>
            <p className="text-xs mb-3 leading-relaxed">Get the latest deals &amp; offers.</p>
            <form onSubmit={handleSubscribe} className="space-y-2">
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full px-3 py-2 pr-9 bg-white/[0.07] border border-white/10 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                  required
                />
                <Send size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              </div>
              <button
                type="submit"
                className="w-full px-3 py-2 bg-primary-600 text-white text-xs font-semibold rounded-lg hover:bg-primary-700 transition-all duration-200"
              >
                {subscribed ? "✓ Subscribed!" : "Subscribe"}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Trust bar */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {[
              { icon: Truck, label: "Free Shipping on Bulk Orders" },
              { icon: Shield, label: "Secure Payments" },
              { icon: RefreshCw, label: "Easy Returns" },
              { icon: CreditCard, label: "Multiple Payment Options" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-xs text-gray-400 bg-white/[0.04] border border-white/[0.06] rounded-full px-3.5 py-1.5">
                <Icon size={14} className="text-primary-500 flex-shrink-0" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              &copy; {currentYear} {copyrightText}
            </p>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-600">We accept:</span>
              <div className="flex items-center gap-1.5">
                <span className="px-2.5 py-1 bg-white/[0.07] rounded-full text-[10px] font-bold text-gray-400 tracking-wide">VISA</span>
                <span className="px-2.5 py-1 bg-white/[0.07] rounded-full text-[10px] font-bold text-gray-400 tracking-wide">MC</span>
                <span className="px-2.5 py-1 bg-white/[0.07] rounded-full text-[10px] font-bold text-gray-400 tracking-wide">UPI</span>
                <span className="px-2.5 py-1 bg-white/[0.07] rounded-full text-[10px] font-bold text-gray-400 tracking-wide">COD</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}