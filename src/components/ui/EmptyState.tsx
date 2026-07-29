import Link from "next/link"
import type { LucideIcon } from "lucide-react"

interface EmptyStateAction {
  label: string
  href?: string
  onClick?: () => void
}

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: EmptyStateAction
  secondaryAction?: EmptyStateAction
}

export function EmptyState({ icon: Icon, title, description, action, secondaryAction }: EmptyStateProps) {
  const renderAction = (a: EmptyStateAction, variant: "primary" | "outline") => {
    const className = variant === "primary" ? "btn-primary" : "btn-outline"
    if (a.href) {
      return (
        <Link href={a.href} className={className}>
          {a.label}
        </Link>
      )
    }
    return (
      <button onClick={a.onClick} className={className}>
        {a.label}
      </button>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4">
      <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
        <Icon size={28} className="text-gray-300" />
      </div>
      <h3 className="heading-sm mb-1.5">{title}</h3>
      {description && <p className="body-sm max-w-sm mb-6">{description}</p>}
      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {action && renderAction(action, "primary")}
          {secondaryAction && renderAction(secondaryAction, "outline")}
        </div>
      )}
    </div>
  )
}
