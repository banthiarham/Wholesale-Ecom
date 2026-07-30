"use client"

import { useState } from "react"
import Link from "next/link"
import { Package, Mail, Phone, Facebook, Twitter, Instagram, Linkedin, Send, ChevronRight, CreditCard, Truck, Shield, RefreshCw } from "lucide-react"
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
  { label: "Returns & Refunds", href: "/returns" },
  { label: "Terms of Service", href: "/terms" },
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

      {/* Main footer content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 lg:pt-18 pb-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">
          {/* Column 1 — Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-5">
              {logoUrl ? (
                <img src={logoUrl} alt={siteName} className="h-9 w-auto object-contain brightness-0 invert" />
              ) : (
                <>
                  <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center shadow-[0_4px_12px_-2px_rgba(3,105,161,0.5)]">
                    <Package size={20} className="text-white" />
                  </div>
                  <span className="text-xl font-bold text-white tracking-tight">{siteName}</span>
                </>
              )}
            </Link>
            <p className="text-sm leading-relaxed mb-6 max-w-xs">
              India&apos;s trusted B2B wholesale marketplace. Bulk orders, best prices, fast delivery.
            </p>
            <div className="flex items-center gap-2.5">
              {socialIcons.map(({ key, icon: Icon, label }) =>
                socialLinks[key] ? (
                  <a
                    key={key}
                    href={socialLinks[key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-primary-600 hover:text-white hover:-translate-y-0.5 transition-all duration-200"
                    aria-label={label}
                  >
                    <Icon size={18} />
                  </a>
                ) : (
                  <div
                    key={key}
                    className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center opacity-30"
                    aria-label={label}
                  >
                    <Icon size={18} />
                  </div>
                )
              )}
            </div>
          </div>

          {/* Column 2 — Quick Links */}
          <div>
            <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-5">Quick Links</h3>
            <ul className="space-y-3.5">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm hover:text-white transition-colors duration-200 flex items-center gap-1.5 group">
                    <ChevronRight size={12} className="text-primary-500 opacity-0 -ml-3 group-hover:opacity-100 group-hover:ml-0 transition-all duration-200" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3 — Support */}
          <div>
            <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-5">Support</h3>
            <ul className="space-y-3.5">
              {supportLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm hover:text-white transition-colors duration-200 flex items-center gap-1.5 group">
                    <ChevronRight size={12} className="text-primary-500 opacity-0 -ml-3 group-hover:opacity-100 group-hover:ml-0 transition-all duration-200" />
                    {link.label}
                  </Link>
                </li>
              ))}
              {contactEmail && (
                <li>
                  <a href={`mailto:${contactEmail}`} className="text-sm hover:text-white transition-colors duration-200 flex items-center gap-2">
                    <Mail size={14} className="text-primary-500" />
                    {contactEmail}
                  </a>
                </li>
              )}
              {contactPhone && (
                <li>
                  <a href={`tel:${contactPhone}`} className="text-sm hover:text-white transition-colors duration-200 flex items-center gap-2">
                    <Phone size={14} className="text-primary-500" />
                    {contactPhone}
                  </a>
                </li>
              )}
            </ul>
          </div>

          {/* Column 4 — Newsletter */}
          <div>
            <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-5">Stay Updated</h3>
            <p className="text-sm mb-4 leading-relaxed">Get the latest deals, new arrivals, and exclusive offers.</p>
            <form onSubmit={handleSubscribe} className="space-y-2.5">
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full px-4 py-2.5 pr-10 bg-white/[0.07] border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                  required
                />
                <Send size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
              </div>
              <button
                type="submit"
                className="w-full px-4 py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 hover:-translate-y-0.5 transition-all duration-200 shadow-[0_4px_14px_-4px_rgba(3,105,161,0.5)]"
              >
                {subscribed ? "✓ Subscribed!" : "Subscribe"}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Trust bar */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7">
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            {[
              { icon: Truck, label: "Free Shipping on Bulk Orders" },
              { icon: Shield, label: "Secure Payments" },
              { icon: RefreshCw, label: "Easy Returns" },
              { icon: CreditCard, label: "Multiple Payment Options" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2.5 text-sm text-gray-400 bg-white/[0.04] border border-white/[0.06] rounded-full px-4 py-2">
                <Icon size={16} className="text-primary-500 flex-shrink-0" />
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