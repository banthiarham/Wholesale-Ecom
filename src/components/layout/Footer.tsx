"use client"

import Link from "next/link"
import { Package, Mail, Phone, Facebook, Twitter, Instagram, Linkedin } from "lucide-react"
import { useSetting } from "@/lib/settings/SiteSettingsProvider"

export default function Footer() {
  const siteName = useSetting("siteName", "WholesaleX Pro")
  const logoUrl = useSetting("logoUrl", "")
  const contactEmail = useSetting("contactEmail", "")
  const contactPhone = useSetting("contactPhone", "")
  const copyrightText = useSetting("copyrightText", "WholesaleX Pro. All rights reserved.")
  const socialLinksRaw = useSetting("socialLinks", '{"facebook":"","twitter":"","instagram":"","linkedin":""}')

  let socialLinks: Record<string, string> = { facebook: "", twitter: "", instagram: "", linkedin: "" }
  try {
    socialLinks = JSON.parse(socialLinksRaw)
  } catch {}

  const socialIcons = [
    { key: "facebook", icon: Facebook, label: "Facebook" },
    { key: "twitter", icon: Twitter, label: "Twitter" },
    { key: "instagram", icon: Instagram, label: "Instagram" },
    { key: "linkedin", icon: Linkedin, label: "LinkedIn" },
  ]

  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-gray-900 text-gray-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2 mb-4">
              {logoUrl ? (
                <img src={logoUrl} alt={siteName} className="h-8 w-auto object-contain brightness-0 invert" />
              ) : (
                <>
                  <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                    <Package size={18} className="text-white" />
                  </div>
                  <span className="text-xl font-bold text-white">{siteName}</span>
                </>
              )}
            </Link>
            <p className="text-sm leading-relaxed">
              India&apos;s trusted B2B wholesale marketplace. Bulk orders, best prices, fast delivery.
            </p>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-white font-semibold mb-4">Contact Us</h3>
            <ul className="space-y-3">
              {contactEmail && (
                <li className="flex items-center gap-2 text-sm">
                  <Mail size={16} />
                  <a href={`mailto:${contactEmail}`} className="hover:text-white transition">{contactEmail}</a>
                </li>
              )}
              {contactPhone && (
                <li className="flex items-center gap-2 text-sm">
                  <Phone size={16} />
                  <a href={`tel:${contactPhone}`} className="hover:text-white transition">{contactPhone}</a>
                </li>
              )}
              {!contactEmail && !contactPhone && (
                <li className="text-sm">No contact info configured yet.</li>
              )}
            </ul>
          </div>

          {/* Social */}
          <div>
            <h3 className="text-white font-semibold mb-4">Follow Us</h3>
            <div className="flex items-center gap-3">
              {socialIcons.map(({ key, icon: Icon, label }) =>
                socialLinks[key] ? (
                  <a
                    key={key}
                    href={socialLinks[key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center hover:bg-primary-600 transition"
                    aria-label={label}
                  >
                    <Icon size={18} className="text-white" />
                  </a>
                ) : (
                  <div
                    key={key}
                    className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center opacity-40"
                    aria-label={label}
                  >
                    <Icon size={18} />
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-10 pt-6 text-center text-sm">
          &copy; {currentYear} {copyrightText}
        </div>
      </div>
    </footer>
  )
}