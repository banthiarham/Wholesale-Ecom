"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { useSetting } from "@/lib/settings/SiteSettingsProvider"

export default function AnnouncementBar() {
  const enabled = useSetting("announcementBarEnabled", "false")
  const text = useSetting("announcementBarText", "")
  const color = useSetting("announcementBarColor", "#ffffff")
  const bgColor = useSetting("announcementBarBgColor", "#ef4444")
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setDismissed(sessionStorage.getItem("announcement_dismissed") === "true")
  }, [])

  if (enabled !== "true" || !text || dismissed) return null

  return (
    <div className="relative" style={{ backgroundColor: bgColor, color }}>
      <div className="section-container py-2 text-center text-sm font-medium">
        {text}
      </div>
      <button
        onClick={() => { setDismissed(true); sessionStorage.setItem("announcement_dismissed", "true") }}
        className="absolute right-4 top-1/2 -translate-y-1/2 hover:opacity-70"
        style={{ color }}
      >
        <X size={16} />
      </button>
    </div>
  )
}