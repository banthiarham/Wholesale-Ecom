"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"

// ---- Types ----

interface UserRole {
  id: string
  name: string
  label: string
  color: string | null
  icon: string | null
}

interface AuthUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string // legacy enum
  roleId: string | null
  roleRel: UserRole | null
  effectiveRole?: string
  [key: string]: any
}

interface AuthState {
  user: AuthUser | null
  role: UserRole | null
  permissions: Set<string>
  loading: boolean
}

interface AuthContextType extends AuthState {
  can: (action: string, resource: string) => boolean
  canAny: (permissions: string[]) => boolean
  refresh: () => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  permissions: new Set(),
  loading: true,
  can: () => false,
  canAny: () => false,
  refresh: async () => {},
  logout: () => {},
})

// ---- Provider ----

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [permissions, setPermissions] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const fetchAuth = useCallback(async () => {
    // Guard against SSR — localStorage not available during server rendering
    if (typeof window === "undefined") {
      setLoading(false)
      return
    }
    const token = localStorage.getItem("token")
    if (!token) {
      setUser(null)
      setRole(null)
      setPermissions(new Set())
      setLoading(false)
      return
    }

    try {
      const headers = { Authorization: `Bearer ${token}` }

      // Fetch user and permissions in parallel
      const [userRes, permRes] = await Promise.all([
        fetch("/api/auth/me", { headers }).catch(() => null),
        fetch("/api/roles/me/permissions", { headers }).catch(() => null),
      ])

      let userData: AuthUser | null = null
      let permList: { action: string; resource: string }[] = []

      if (userRes?.ok) {
        const data = await userRes.json()
        // /api/auth/me returns user directly (flat), but some endpoints wrap it as { user: {...} }
        userData = (data.user && typeof data.user === "object") ? data.user : (data.id ? data : null)
      }

      if (permRes?.ok) {
        const data = await permRes.json()
        permList = data.permissions || []
      }

      if (userData) {
        const effectiveRole = userData.effectiveRole || userData.roleRel?.name || userData.role
        const userRole = userData.roleRel || (effectiveRole ? { id: userData.roleId || "", name: effectiveRole, label: effectiveRole, color: null, icon: null } : null)

        setUser(userData)
        setRole(userRole)
        setPermissions(new Set(permList.map((p: any) => `${p.action}:${p.resource}`)))
      } else {
        // Token invalid — clear it
        localStorage.removeItem("token")
        setUser(null)
        setRole(null)
        setPermissions(new Set())
      }
    } catch {
      setUser(null)
      setRole(null)
      setPermissions(new Set())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAuth()

    // Listen for auth-change events (login, logout from other components)
    const handleAuthChange = (e: any) => {
      if (e.detail) {
        // A user was logged in — re-fetch full auth state
        fetchAuth()
      } else {
        // Logout
        setUser(null)
        setRole(null)
        setPermissions(new Set())
      }
    }

    window.addEventListener("auth-change", handleAuthChange)
    return () => window.removeEventListener("auth-change", handleAuthChange)
  }, [fetchAuth])

  const can = useCallback(
    (action: string, resource: string) => {
      if (!user) return false
      // ADMIN role has all permissions
      const effectiveRoleName = user.effectiveRole || user.roleRel?.name || user.role
      if (effectiveRoleName === "ADMIN") return true
      return permissions.has(`${action}:${resource}`)
    },
    [user, permissions]
  )

  const canAny = useCallback(
    (permList: string[]) => {
      if (!user) return false
      const effectiveRoleName = user.effectiveRole || user.roleRel?.name || user.role
      if (effectiveRoleName === "ADMIN") return true
      return permList.some((p) => permissions.has(p))
    },
    [user, permissions]
  )

  const logout = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token")
    }
    setUser(null)
    setRole(null)
    setPermissions(new Set())
    window.dispatchEvent(new CustomEvent("auth-change", { detail: null }))
    window.location.href = "/"
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    await fetchAuth()
  }, [fetchAuth])

  return (
    <AuthContext.Provider value={{ user, role, permissions, loading, can, canAny, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// ---- Hooks ----

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return {
    user: context.user,
    role: context.role,
    loading: context.loading,
    refresh: context.refresh,
    logout: context.logout,
  }
}

export function usePermissions() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("usePermissions must be used within an AuthProvider")
  }
  return {
    permissions: context.permissions,
    can: context.can,
    canAny: context.canAny,
  }
}