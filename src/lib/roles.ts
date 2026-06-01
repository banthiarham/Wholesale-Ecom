"use client"

// ---- Types ----

export interface Role {
  id: string
  name: string
  label: string
  description: string | null
  isSystem: boolean
  color: string | null
  icon: string | null
  createdAt: string
  updatedAt: string
  userCount?: number
  permissionCount?: number
  rolePriceCount?: number
  permissions?: Permission[]
}

export interface Permission {
  id: string
  action: string
  resource: string
  description: string | null
}

export interface RolePrice {
  id: string
  productId: string
  roleId: string
  price: number
  minQty: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  product?: { id: string; title: string; handle: string }
  role?: { id: string; name: string; label: string; color: string | null; icon: string | null }
}

export interface RoleChangeRequest {
  id: string
  userId: string
  roleId: string
  status: "PENDING" | "APPROVED" | "REJECTED"
  reason: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
  user?: { id: string; firstName: string; lastName: string; email: string }
  role?: { id: string; name: string; label: string; color: string | null; icon: string | null }
}

const API_BASE = "/api"

// ---- Role API ----

export async function fetchRoles(): Promise<Role[]> {
  const res = await fetch(`${API_BASE}/roles`, { credentials: "include" })
  if (!res.ok) throw new Error("Failed to fetch roles")
  const data = await res.json()
  return data.roles || []
}

export async function fetchRole(id: string): Promise<Role> {
  const res = await fetch(`${API_BASE}/roles/${id}`, { credentials: "include" })
  if (!res.ok) throw new Error("Failed to fetch role")
  return res.json()
}

export async function createRole(data: { name: string; label: string; description?: string; color?: string; icon?: string }): Promise<Role> {
  const res = await fetch(`${API_BASE}/roles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to create role")
  const result = await res.json()
  return result.role
}

export async function updateRole(id: string, data: { label?: string; description?: string; color?: string; icon?: string }): Promise<Role> {
  const res = await fetch(`${API_BASE}/roles/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to update role")
  const result = await res.json()
  return result.role
}

export async function deleteRole(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/roles/${id}`, {
    method: "DELETE",
    credentials: "include",
  })
  if (!res.ok) throw new Error("Failed to delete role")
}

export async function setRolePermissions(roleId: string, permissionIds: string[]): Promise<Role> {
  const res = await fetch(`${API_BASE}/roles/${roleId}/permissions`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ permissionIds }),
  })
  if (!res.ok) throw new Error("Failed to set permissions")
  return res.json()
}

// ---- Permissions API ----

export async function fetchPermissions(): Promise<Permission[]> {
  const res = await fetch(`${API_BASE}/roles/permissions`, { credentials: "include" })
  if (!res.ok) throw new Error("Failed to fetch permissions")
  const data = await res.json()
  return data.permissions || []
}

export async function createPermission(data: { action: string; resource: string; description?: string }): Promise<Permission> {
  const res = await fetch(`${API_BASE}/roles/permissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to create permission")
  const result = await res.json()
  return result.permission
}

// ---- Role Prices API ----

export async function fetchRolePrices(productId?: string, roleId?: string): Promise<RolePrice[]> {
  const params = new URLSearchParams()
  if (productId) params.set("productId", productId)
  if (roleId) params.set("roleId", roleId)
  const res = await fetch(`${API_BASE}/pricing/role-prices?${params.toString()}`, { credentials: "include" })
  if (!res.ok) throw new Error("Failed to fetch role prices")
  const data = await res.json()
  return data.rolePrices || []
}

export async function createRolePrice(data: { productId: string; roleId: string; price: number; minQty?: number; isActive?: boolean }): Promise<RolePrice> {
  const res = await fetch(`${API_BASE}/pricing/role-prices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to create role price")
  const result = await res.json()
  return result.rolePrice
}

export async function updateRolePrice(id: string, data: { price?: number; minQty?: number; isActive?: boolean }): Promise<RolePrice> {
  const res = await fetch(`${API_BASE}/pricing/role-prices/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to update role price")
  const result = await res.json()
  return result.rolePrice
}

export async function deleteRolePrice(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/pricing/role-prices/${id}`, {
    method: "DELETE",
    credentials: "include",
  })
  if (!res.ok) throw new Error("Failed to delete role price")
}

export async function bulkSetRolePrices(data: { productId: string; prices: { roleId: string; price: number; minQty?: number }[] }): Promise<RolePrice[]> {
  const res = await fetch(`${API_BASE}/pricing/role-prices/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to bulk set role prices")
  const result = await res.json()
  return result.rolePrices || []
}

// ---- Role Requests API ----

export async function submitRoleRequest(data: { roleId: string; reason?: string }): Promise<RoleChangeRequest> {
  const res = await fetch(`${API_BASE}/role-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to submit role request")
  const result = await res.json()
  return result.request
}

export async function fetchRoleRequests(status?: string): Promise<RoleChangeRequest[]> {
  const params = new URLSearchParams()
  if (status) params.set("status", status)
  const res = await fetch(`${API_BASE}/role-requests?${params.toString()}`, { credentials: "include" })
  if (!res.ok) throw new Error("Failed to fetch role requests")
  const data = await res.json()
  return data.requests || []
}

export async function fetchMyRoleRequests(): Promise<RoleChangeRequest[]> {
  const res = await fetch(`${API_BASE}/role-requests/mine`, { credentials: "include" })
  if (!res.ok) throw new Error("Failed to fetch your role requests")
  const data = await res.json()
  return data.requests || []
}

export async function approveRoleRequest(id: string): Promise<RoleChangeRequest> {
  const res = await fetch(`${API_BASE}/role-requests/${id}/approve`, {
    method: "PATCH",
    credentials: "include",
  })
  if (!res.ok) throw new Error("Failed to approve role request")
  const result = await res.json()
  return result.request
}

export async function rejectRoleRequest(id: string): Promise<RoleChangeRequest> {
  const res = await fetch(`${API_BASE}/role-requests/${id}/reject`, {
    method: "PATCH",
    credentials: "include",
  })
  if (!res.ok) throw new Error("Failed to reject role request")
  const result = await res.json()
  return result.request
}

// ---- User Role Assignment ----

export async function assignUserRole(userId: string, roleId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/users/${userId}/assign-role`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ roleId }),
  })
  if (!res.ok) throw new Error("Failed to assign role")
  return res.json()
}