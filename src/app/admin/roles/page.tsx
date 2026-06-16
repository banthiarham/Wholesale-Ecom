"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Plus,
  Trash2,
  Edit,
  X,
  Shield,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Search,
  Check,
  Users,
  Lock,
} from "lucide-react"
import type { Role, Permission } from "@/lib/roles"
import { SkeletonTable } from "@/components/admin/Skeleton"

interface RoleFormData {
  name: string
  label: string
  description: string
  color: string
  icon: string
}

const emptyForm: RoleFormData = {
  name: "",
  label: "",
  description: "",
  color: "#6366f1",
  icon: "",
}

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [form, setForm] = useState<RoleFormData>(emptyForm)
  const [formError, setFormError] = useState("")
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null)
  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null)
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({})
  const [permissionsLoading, setPermissionsLoading] = useState(false)
  const [savingPermissions, setSavingPermissions] = useState(false)

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : ""

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }

  useEffect(() => {
    loadRoles()
  }, [token])

  const loadRoles = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/roles", {
        credentials: "include",
        headers,
      })
      const data = await res.json()
      const roleList: Role[] = data.roles || []
      setRoles(roleList)
      // Extract permission IDs from roles that include them
      const permMap: Record<string, string[]> = {}
      for (const r of roleList) {
        if (r.permissions) {
          permMap[r.id] = r.permissions.map((p) => p.id)
        }
      }
      setRolePermissions(permMap)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadPermissions = async () => {
    setPermissionsLoading(true)
    try {
      const res = await fetch("/api/roles/permissions", {
        credentials: "include",
        headers,
      })
      const data = await res.json()
      setPermissions(data.permissions || [])
    } catch (err) {
      console.error(err)
    } finally {
      setPermissionsLoading(false)
    }
  }

  const loadRolePermissions = async (roleId: string) => {
    try {
      const res = await fetch(`/api/roles/${roleId}`, {
        credentials: "include",
        headers,
      })
      const data = await res.json()
      if (data.permissions) {
        setRolePermissions((prev) => ({
          ...prev,
          [roleId]: data.permissions.map((p: Permission) => p.id),
        }))
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleToggleExpand = async (roleId: string) => {
    if (expandedRoleId === roleId) {
      setExpandedRoleId(null)
      return
    }
    setExpandedRoleId(roleId)
    // Load permissions list if not yet loaded
    if (permissions.length === 0) {
      await loadPermissions()
    }
    // Load this role's assigned permissions if not cached
    if (!rolePermissions[roleId]) {
      await loadRolePermissions(roleId)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")
    if (!form.name.trim() || !form.label.trim()) {
      setFormError("Name and label are required.")
      return
    }
    setFormSubmitting(true)
    try {
      const body: Record<string, string> = {
        name: form.name.trim(),
        label: form.label.trim(),
      }
      if (form.description.trim()) body.description = form.description.trim()
      if (form.color) body.color = form.color
      if (form.icon.trim()) body.icon = form.icon.trim()

      const res = await fetch("/api/roles", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.message || "Failed to create role")
      }
      setShowCreateModal(false)
      setForm(emptyForm)
      loadRoles()
    } catch (err: any) {
      setFormError(err.message || "Failed to create role")
    } finally {
      setFormSubmitting(false)
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")
    if (!editingRole) return
    if (!form.label.trim()) {
      setFormError("Label is required.")
      return
    }
    setFormSubmitting(true)
    try {
      const body: Record<string, string> = {
        label: form.label.trim(),
      }
      if (form.description.trim()) body.description = form.description.trim()
      if (form.color) body.color = form.color
      if (form.icon.trim()) body.icon = form.icon.trim()

      const res = await fetch(`/api/roles/${editingRole.id}`, {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.message || "Failed to update role")
      }
      setEditingRole(null)
      setForm(emptyForm)
      loadRoles()
    } catch (err: any) {
      setFormError(err.message || "Failed to update role")
    } finally {
      setFormSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      const res = await fetch(`/api/roles/${deleteTarget.id}`, {
        method: "DELETE",
        headers,
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to delete role")
      setRoles((prev) => prev.filter((r) => r.id !== deleteTarget.id))
    } catch (err) {
      console.error(err)
      alert("Failed to delete role")
    }
    setDeleteTarget(null)
  }

  const openEdit = (role: Role) => {
    setEditingRole(role)
    setForm({
      name: role.name,
      label: role.label,
      description: role.description || "",
      color: role.color || "#6366f1",
      icon: role.icon || "",
    })
    setFormError("")
  }

  const handlePermissionToggle = (permId: string) => {
    if (!expandedRoleId) return
    setRolePermissions((prev) => {
      const current = prev[expandedRoleId] || []
      const next = current.includes(permId)
        ? current.filter((id) => id !== permId)
        : [...current, permId]
      return { ...prev, [expandedRoleId]: next }
    })
  }

  const handleSavePermissions = async () => {
    if (!expandedRoleId) return
    setSavingPermissions(true)
    try {
      const permIds = rolePermissions[expandedRoleId] || []
      const res = await fetch(`/api/roles/${expandedRoleId}/permissions`, {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify({ permissionIds: permIds }),
      })
      if (!res.ok) throw new Error("Failed to save permissions")
      await loadRoles()
    } catch (err) {
      console.error(err)
      alert("Failed to save permissions")
    } finally {
      setSavingPermissions(false)
    }
  }

  const handleResourceSelectAll = (resource: string, permIdsForResource: string[]) => {
    if (!expandedRoleId) return
    setRolePermissions((prev) => {
      const current = prev[expandedRoleId] || []
      const allSelected = permIdsForResource.every((id) => current.includes(id))
      let next: string[]
      if (allSelected) {
        // Deselect all for this resource
        next = current.filter((id) => !permIdsForResource.includes(id))
      } else {
        // Select all for this resource
        next = Array.from(new Set([...current, ...permIdsForResource]))
      }
      return { ...prev, [expandedRoleId]: next }
    })
  }

  // Group permissions by resource
  const groupedPermissions = useCallback(() => {
    const groups: Record<string, Permission[]> = {}
    for (const p of permissions) {
      if (!groups[p.resource]) groups[p.resource] = []
      groups[p.resource].push(p)
    }
    return groups
  }, [permissions])

  const filteredRoles = roles.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.label.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={16} />
          <input
            type="text"
            placeholder="Search roles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm w-64"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {filteredRoles.length} role{filteredRoles.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => {
              setShowCreateModal(true)
              setForm(emptyForm)
              setFormError("")
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm"
          >
            <Plus size={16} /> Add Role
          </button>
        </div>
      </div>

      {/* Role List */}
      {loading ? (
        <SkeletonTable rows={4} cols={7} />
      ) : filteredRoles.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 shadow-sm p-8 text-center">
          <Shield size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No roles found.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Label</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Color</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">
                    <Users size={14} className="inline mr-1" />
                    Users
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">
                    <ShieldCheck size={14} className="inline mr-1" />
                    Perms
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">System</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {filteredRoles.map((role) => (
                  <RoleRow
                    key={role.id}
                    role={role}
                    expanded={expandedRoleId === role.id}
                    onToggleExpand={() => handleToggleExpand(role.id)}
                    onEdit={() => openEdit(role)}
                    onDelete={() => setDeleteTarget(role)}
                    permissions={permissions}
                    rolePermissionIds={rolePermissions[role.id] || []}
                    onTogglePermission={handlePermissionToggle}
                    onResourceSelectAll={handleResourceSelectAll}
                    onSavePermissions={handleSavePermissions}
                    savingPermissions={savingPermissions}
                    permissionsLoading={permissionsLoading}
                    groupedPermissions={groupedPermissions()}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Role Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Create Role</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={18} />
              </button>
            </div>
            <RoleForm
              form={form}
              setForm={setForm}
              onSubmit={handleCreate}
              error={formError}
              submitting={formSubmitting}
              isSystem={false}
              isEdit={false}
            />
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {editingRole && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Edit Role</h3>
              <button
                onClick={() => setEditingRole(null)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={18} />
              </button>
            </div>
            <RoleForm
              form={form}
              setForm={setForm}
              onSubmit={handleEdit}
              error={formError}
              submitting={formSubmitting}
              isSystem={editingRole.isSystem}
              isEdit={true}
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 w-80">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Delete Role</h3>
              <button
                onClick={() => setDeleteTarget(null)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Are you sure you want to delete <strong>{deleteTarget.label}</strong>?
            </p>
            <p className="text-sm text-red-600 mb-4">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 text-sm transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- Sub-components ---------- */

function RoleRow({
  role,
  expanded,
  onToggleExpand,
  onEdit,
  onDelete,
  permissions,
  rolePermissionIds,
  onTogglePermission,
  onResourceSelectAll,
  onSavePermissions,
  savingPermissions,
  permissionsLoading,
  groupedPermissions,
}: {
  role: Role
  expanded: boolean
  onToggleExpand: () => void
  onEdit: () => void
  onDelete: () => void
  permissions: Permission[]
  rolePermissionIds: string[]
  onTogglePermission: (permId: string) => void
  onResourceSelectAll: (resource: string, permIds: string[]) => void
  onSavePermissions: () => void
  savingPermissions: boolean
  permissionsLoading: boolean
  groupedPermissions: Record<string, Permission[]>
}) {
  return (
    <>
      <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
        <td className="px-4 py-3">
          <button
            onClick={onToggleExpand}
            className="flex items-center gap-2 group"
          >
            {expanded ? (
              <ChevronDown size={16} className="text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
            ) : (
              <ChevronRight size={16} className="text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
            )}
            <span className="font-medium text-gray-900 dark:text-gray-100">{role.name}</span>
          </button>
        </td>
        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{role.label}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className="w-5 h-5 rounded-full border border-gray-200 dark:border-gray-700"
              style={{ backgroundColor: role.color || "#6366f1" }}
            />
            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{role.color || "—"}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
          {role.userCount ?? 0}
        </td>
        <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
          {role.permissionCount ?? (role.permissions?.length ?? 0)}
        </td>
        <td className="px-4 py-3">
          {role.isSystem ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
              <Lock size={10} /> System
            </span>
          ) : (
            <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={onEdit}
              className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 rounded hover:bg-primary-50 dark:hover:bg-primary-900/30"
              title="Edit role"
            >
              <Edit size={16} />
            </button>
            {!role.isSystem && (
              <button
                onClick={onDelete}
                className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                title="Delete role"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="px-4 py-0">
            <PermissionMatrix
              permissions={permissions}
              rolePermissionIds={rolePermissionIds}
              onTogglePermission={onTogglePermission}
              onResourceSelectAll={onResourceSelectAll}
              onSavePermissions={onSavePermissions}
              savingPermissions={savingPermissions}
              permissionsLoading={permissionsLoading}
              groupedPermissions={groupedPermissions}
            />
          </td>
        </tr>
      )}
    </>
  )
}

function PermissionMatrix({
  permissions,
  rolePermissionIds,
  onTogglePermission,
  onResourceSelectAll,
  onSavePermissions,
  savingPermissions,
  permissionsLoading,
  groupedPermissions,
}: {
  permissions: Permission[]
  rolePermissionIds: string[]
  onTogglePermission: (permId: string) => void
  onResourceSelectAll: (resource: string, permIds: string[]) => void
  onSavePermissions: () => void
  savingPermissions: boolean
  permissionsLoading: boolean
  groupedPermissions: Record<string, Permission[]>
}) {
  if (permissionsLoading && permissions.length === 0) {
    return (
      <div className="flex justify-center py-6">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (permissions.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">
        No permissions available. Create permissions first.
      </div>
    )
  }

  const resources = Object.keys(groupedPermissions).sort()

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-lg p-4 my-3">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Permissions</h4>
        <button
          onClick={onSavePermissions}
          disabled={savingPermissions}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-xs disabled:opacity-50"
        >
          <Check size={14} />
          {savingPermissions ? "Saving..." : "Save Permissions"}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800">
              <th className="py-2 px-3 text-left font-medium text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide">
                Resource
              </th>
              <th className="py-2 px-3 text-left font-medium text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {resources.map((resource) => {
              const permsForResource = groupedPermissions[resource]
              const allSelected = permsForResource.every((p) =>
                rolePermissionIds.includes(p.id)
              )
              return (
                <tr key={resource} className="hover:bg-white dark:hover:bg-gray-800/50 transition">
                  <td className="py-2 px-3 font-medium text-gray-800 dark:text-gray-200 text-xs">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() =>
                          onResourceSelectAll(
                            resource,
                            permsForResource.map((p) => p.id)
                          )
                        }
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="font-semibold">{resource}</span>
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex flex-wrap gap-2">
                      {permsForResource.map((p) => {
                        const checked = rolePermissionIds.includes(p.id)
                        return (
                          <label
                            key={p.id}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs cursor-pointer transition ${
                              checked
                                ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 border border-primary-200 dark:border-primary-800"
                                : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => onTogglePermission(p.id)}
                              className="sr-only"
                            />
                            {p.action}
                          </label>
                        )
                      })}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RoleForm({
  form,
  setForm,
  onSubmit,
  error,
  submitting,
  isSystem,
  isEdit,
}: {
  form: RoleFormData
  setForm: React.Dispatch<React.SetStateAction<RoleFormData>>
  onSubmit: (e: React.FormEvent) => void
  error: string
  submitting: boolean
  isSystem: boolean
  isEdit: boolean
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg px-3 py-2">
          {error}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
        <input
          type="text"
          required
          placeholder="e.g. VIP_CUSTOMER"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          disabled={isEdit && isSystem}
          className={`w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm ${
            isEdit && isSystem ? "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed" : ""
          }`}
        />
        {isEdit && isSystem && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">System role names cannot be changed.</p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Label</label>
        <input
          type="text"
          required
          placeholder="e.g. VIP Customer"
          value={form.label}
          onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Description <span className="text-gray-400 dark:text-gray-500">(optional)</span>
        </label>
        <textarea
          placeholder="Role description..."
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          rows={2}
          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm resize-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Color <span className="text-gray-400 dark:text-gray-500">(optional)</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.color || "#6366f1"}
              onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
              className="h-9 w-12 rounded border border-gray-200 dark:border-gray-700 cursor-pointer"
            />
            <input
              type="text"
              value={form.color}
              onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
              placeholder="#6366f1"
              className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm font-mono"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Icon <span className="text-gray-400 dark:text-gray-500">(optional)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Shield, Crown"
            value={form.icon}
            onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm"
          />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => {
            if (isEdit) setForm(emptyForm)
            // Parent will close the modal
          }}
          className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg text-sm"
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm disabled:opacity-50"
        >
          {submitting ? "Saving..." : isEdit ? "Update Role" : "Create Role"}
        </button>
      </div>
    </form>
  )
}