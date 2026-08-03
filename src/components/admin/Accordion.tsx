"use client"

import { ReactNode } from "react"
import { ChevronDown } from "lucide-react"

interface AccordionProps {
  open: boolean
  onToggle: () => void
  title: ReactNode
  icon?: ReactNode
  badge?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * Generic collapsible section used across admin settings panels.
 * Height is animated via a CSS grid-template-rows transition (0fr <-> 1fr)
 * so it works for arbitrary/variable content height without JS measurement.
 */
export function Accordion({ open, onToggle, title, icon, badge, children, className = "" }: AccordionProps) {
  return (
    <div className={`border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden ${className}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</span>
          {badge}
        </div>
        <ChevronDown
          size={16}
          className={`text-gray-400 dark:text-gray-500 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div className={`transition-opacity duration-200 ${open ? "opacity-100 delay-100" : "opacity-0"}`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
