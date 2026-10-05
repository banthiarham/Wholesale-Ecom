import { ReactNode } from "react"

/** Admin form field with a visible heading above the control, so the label stays readable after typing. */
export function FormField({ label, required, hint, className = "", children }: { label: string; required?: boolean; hint?: string; className?: string; children: ReactNode }) {
  return (
    <div className={`flex flex-col gap-1.5 min-w-0 ${className}`}>
      <label className="text-sm font-semibold text-gray-800 dark:text-gray-200">
        {label}{required && <span className="text-red-600 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 dark:text-gray-500">{hint}</p>}
    </div>
  )
}
