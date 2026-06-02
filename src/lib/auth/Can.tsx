"use client"

import { ReactNode } from "react"
import { usePermissions } from "./AuthProvider"

interface CanProps {
  /** Permission string in "action:resource" format, e.g. "products:view" */
  permission: string
  /** Content to show if permission is denied. Defaults to null (hide completely). */
  fallback?: ReactNode
  children: ReactNode
}

/**
 * Declarative permission gating component.
 * Renders children only if the current user has the specified permission.
 * ADMIN users always pass.
 *
 * @example
 * <Can permission="rfqs:view">
 *   <Link href="/rfqs">RFQs</Link>
 * </Can>
 *
 * <Can permission="products:purchase" fallback={<p>Login to purchase</p>}>
 *   <button>Add to Cart</button>
 * </Can>
 */
export function Can({ permission, fallback = null, children }: CanProps) {
  const { can } = usePermissions()
  const [action, resource] = permission.includes(":") ? permission.split(":") : [permission, "*"]

  if (can(action, resource)) {
    return <>{children}</>
  }

  return <>{fallback}</>
}