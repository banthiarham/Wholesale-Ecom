"use client"

import { useState } from "react"
import { Plus, Trash2, X, RotateCcw, ImagePlus } from "lucide-react"

export interface VariantOptionDraft {
  name: string
  values: string[]
}

/** An image in the product's shared image pool (saved URL, or a picked file that is uploaded on save). */
export interface PoolImage {
  key: string
  src: string
  file?: File
}

export const MAX_VARIANT_IMAGES = 10

export interface VariantRowDraft {
  /** Saved variant id; absent for variants not saved yet. */
  id?: string
  options: Record<string, string>
  sku: string
  price: string
  inventoryQuantity: string
  /** Keys of this variant's images in the product pool, in the order customers see them (first = main). */
  imageKeys: string[]
  isActive: boolean
}

export interface VariantEditorState {
  options: VariantOptionDraft[]
  rows: VariantRowDraft[]
  /** Combinations the admin chose not to sell; they are not re-added when options change. */
  excluded: Record<string, string>[]
}

export const emptyVariantState: VariantEditorState = { options: [{ name: "", values: [] }], rows: [], excluded: [] }

const MAX_OPTIONS = 5

const usableOptions = (options: VariantOptionDraft[]) => options.filter((o) => o.name.trim() && o.values.length > 0)

/** Same canonical key the backend uses, so a combination is identified the same way on both sides. */
export const combinationKey = (options: VariantOptionDraft[], values: Record<string, string>) =>
  usableOptions(options).map((o) => `${o.name.trim().toLowerCase()}=${String(values[o.name.trim()] ?? "").toLowerCase()}`).join("|")

export const combinationLabel = (options: VariantOptionDraft[], values: Record<string, string>) =>
  usableOptions(options).map((o) => values[o.name.trim()]).filter(Boolean).join(" / ")

function cartesian(options: VariantOptionDraft[]): Record<string, string>[] {
  return options.reduce<Record<string, string>[]>(
    (acc, o) => acc.flatMap((combo) => o.values.map((v) => ({ ...combo, [o.name.trim()]: v }))),
    [{}],
  )
}

const slug = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "")

/**
 * Builds the variant rows for the current options: one row per combination that is not excluded.
 * Existing rows keep their data (id, SKU, price, stock, image) when they still match a combination,
 * including after an option is added (they take its first value) or removed.
 */
function buildRows(
  options: VariantOptionDraft[],
  prev: VariantRowDraft[],
  excluded: Record<string, string>[],
  defaults: { skuBase: string; price: string },
): VariantRowDraft[] {
  const valid = usableOptions(options)
  if (valid.length === 0) return []
  const names = valid.map((o) => o.name.trim())
  const excludedKeys = new Set(excluded.map((e) => combinationKey(valid, e)))
  const used = new Set<VariantRowDraft>()
  const matches = (row: VariantRowDraft, combo: Record<string, string>, exact: boolean) =>
    names.every((n) => (row.options[n] === undefined ? !exact : row.options[n] === combo[n]))

  return cartesian(valid)
    .filter((combo) => !excludedKeys.has(combinationKey(valid, combo)))
    .map((combo) => {
      const row =
        prev.find((r) => !used.has(r) && matches(r, combo, true)) ||
        prev.find((r) => !used.has(r) && matches(r, combo, false))
      if (row) {
        used.add(row)
        return { ...row, options: combo }
      }
      return {
        options: combo,
        sku: slug([defaults.skuBase, ...names.map((n) => combo[n])].filter(Boolean).join("-")),
        price: defaults.price,
        inventoryQuantity: "0",
        imageKeys: [],
        isActive: true,
      }
    })
}

/** Checks the editor state the same way the backend does; returns the first problem, or null. */
export function validateVariantState(state: VariantEditorState): string | null {
  const valid = usableOptions(state.options)
  if (valid.length === 0) return "Add at least one variant option with values (e.g. Color: Black, Blue)"
  if (state.options.some((o) => o.name.trim() && o.values.length === 0)) return "Every variant option needs at least one value"
  if (state.options.some((o) => !o.name.trim() && o.values.length > 0)) return "Every variant option needs a name"
  const names = valid.map((o) => o.name.trim().toLowerCase())
  if (new Set(names).size !== names.length) return "Two variant options have the same name"
  if (state.rows.length === 0) return "Add at least one variant"
  const skus = new Set<string>()
  for (const r of state.rows) {
    const label = combinationLabel(state.options, r.options)
    const sku = r.sku.trim()
    if (!sku) return `Variant "${label}" needs a SKU`
    if (skus.has(sku.toLowerCase())) return `SKU "${sku}" is used by more than one variant`
    skus.add(sku.toLowerCase())
    const price = Number(r.price)
    if (r.price.trim() === "" || !Number.isFinite(price) || price < 0) return `Variant "${label}" needs a valid price`
    const stock = Number(r.inventoryQuantity)
    if (r.inventoryQuantity.trim() === "" || !Number.isInteger(stock) || stock < 0) return `Variant "${label}" needs a whole-number stock of 0 or more`
  }
  return null
}

/** Turns a saved product's options + variants into editor state. */
export function variantStateFromProduct(
  pool: PoolImage[],
  variantOptions: VariantOptionDraft[] | null | undefined,
  variants: { id: string; options: Record<string, string>; sku: string; price: number | string; inventoryQuantity: number; images?: string[] | null; image?: string | null; isActive: boolean }[] | undefined,
): VariantEditorState {
  const options = (variantOptions || []).map((o) => ({ name: o.name, values: [...o.values] }))
  const rows: VariantRowDraft[] = (variants || []).map((v) => ({
    id: v.id,
    options: { ...v.options },
    sku: v.sku,
    price: String(v.price),
    inventoryQuantity: String(v.inventoryQuantity),
    imageKeys: (v.images && v.images.length ? v.images : v.image ? [v.image] : [])
      .map((src) => pool.find((im) => im.src === src)?.key)
      .filter((k): k is string => !!k),
    isActive: v.isActive,
  }))
  // Combinations that have no saved variant were excluded by the admin; keep them excluded.
  const saved = new Set(rows.map((r) => combinationKey(options, r.options)))
  const excluded = cartesian(usableOptions(options)).filter((c) => !saved.has(combinationKey(options, c)))
  return { options: options.length ? options : emptyVariantState.options, rows, excluded }
}

/**
 * Option names are applied when the field is left (or Enter is pressed), not on every keystroke,
 * so variant rows are never rebuilt around a half-typed or momentarily empty name.
 */
function OptionNameInput({ name, hasValues, onCommit }: { name: string; hasValues: boolean; onCommit: (name: string) => boolean | void }) {
  const [draft, setDraft] = useState(name)
  const [prevName, setPrevName] = useState(name)
  if (prevName !== name) { setPrevName(name); setDraft(name) }
  const commit = () => {
    const next = draft.trim()
    if (next === name.trim()) return
    if (!next && hasValues) { setDraft(name); return } // an option with values must keep a name
    if (onCommit(next) === false) setDraft(name)
  }
  return (
    <input
      placeholder="e.g. Color, Size, Storage"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit() } }}
      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
    />
  )
}

const inputCls =
  "px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
const cellInputCls =
  "w-full px-2 py-1.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"

export default function ProductVariantsEditor({
  value,
  onChange,
  pool,
  onAddFiles,
  defaults,
}: {
  value: VariantEditorState
  onChange: (next: VariantEditorState) => void
  /** The product's image pool: every image of the product, including all variants' images. */
  pool: PoolImage[]
  /** Adds device files to the product pool and returns the new pool items. */
  onAddFiles: (files: File[]) => PoolImage[]
  /** Starting SKU prefix and price for newly generated variants. */
  defaults: { skuBase: string; price: string }
}) {
  const [valueInputs, setValueInputs] = useState<Record<number, string>>({})
  const [bulkPrice, setBulkPrice] = useState("")
  const [bulkStock, setBulkStock] = useState("")
  const { options, rows, excluded } = value

  /** Applies new options / exclusions, asking first if saved variants would be removed. */
  const apply = (nextOptions: VariantOptionDraft[], nextExcluded: Record<string, string>[], prevRows = rows) => {
    const nextRows = buildRows(nextOptions, prevRows, nextExcluded, defaults)
    const lost = prevRows.filter((r) => r.id && !nextRows.some((n) => n.id === r.id))
    if (lost.length > 0) {
      const labels = lost.map((r) => combinationLabel(options, r.options) || r.sku).join(", ")
      if (!confirm(`This removes ${lost.length} saved variant${lost.length > 1 ? "s" : ""} (${labels}) and its stock when you save the product. Continue?`)) return false
    }
    onChange({ options: nextOptions, rows: nextRows, excluded: nextExcluded })
    return true
  }

  const setOptionName = (i: number, name: string) => {
    const old = options[i].name.trim()
    const nextName = name.trim()
    if (nextName && options.some((o, idx) => idx !== i && o.name.trim().toLowerCase() === nextName.toLowerCase())) {
      alert(`There is already an option called "${nextName}"`)
      return false
    }
    const rename = (m: Record<string, string>) => {
      if (!old || old === nextName || !(old in m)) return m
      const { [old]: v, ...rest } = m
      return nextName ? { ...rest, [nextName]: v } : rest
    }
    const nextOptions = options.map((o, idx) => (idx === i ? { ...o, name } : o))
    return apply(nextOptions, excluded.map(rename), rows.map((r) => ({ ...r, options: rename(r.options) })))
  }

  const addValue = (i: number) => {
    const raw = (valueInputs[i] || "").split(",").map((v) => v.trim()).filter(Boolean)
    if (raw.length === 0) return
    const current = options[i].values
    const fresh = raw.filter((v, idx) => !current.some((c) => c.toLowerCase() === v.toLowerCase()) && raw.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === idx)
    setValueInputs((p) => ({ ...p, [i]: "" }))
    if (fresh.length === 0) return
    apply(options.map((o, idx) => (idx === i ? { ...o, values: [...o.values, ...fresh] } : o)), excluded)
  }

  const removeValue = (i: number, value: string) =>
    apply(options.map((o, idx) => (idx === i ? { ...o, values: o.values.filter((v) => v !== value) } : o)), excluded)

  const addOption = () => onChange({ ...value, options: [...options, { name: "", values: [] }] })

  const removeOption = (i: number) => {
    const nextOptions = options.filter((_, idx) => idx !== i)
    apply(nextOptions.length ? nextOptions : [{ name: "", values: [] }], excluded)
  }

  const updateRow = (index: number, patch: Partial<VariantRowDraft>) =>
    onChange({ ...value, rows: rows.map((r, i) => (i === index ? { ...r, ...patch } : r)) })

  const excludeRow = (index: number) => {
    const row = rows[index]
    if (row.id && !confirm(`Remove the saved variant "${combinationLabel(options, row.options)}" and its stock when you save the product?`)) return
    onChange({ ...value, rows: rows.filter((_, i) => i !== index), excluded: [...excluded, row.options] })
  }

  const restoreExcluded = () => apply(options, [])

  // Image handling: a variant's images are ordered references into the product's image pool.
  const [imageMenu, setImageMenu] = useState<number | null>(null)
  const [picker, setPicker] = useState<{ row: number; picked: string[] } | null>(null)
  const [dragImg, setDragImg] = useState<{ row: number; index: number } | null>(null)

  const setKeys = (index: number, imageKeys: string[]) => updateRow(index, { imageKeys })

  const addFromDevice = (index: number, files: File[]) => {
    if (files.length === 0) return
    const current = rows[index].imageKeys
    const room = Math.max(0, MAX_VARIANT_IMAGES - current.length)
    if (room === 0) { alert(`A variant can have at most ${MAX_VARIANT_IMAGES} images`); return }
    // The new files are added to the product's images as well as to this variant.
    const added = onAddFiles(files.slice(0, room))
    setKeys(index, [...current, ...added.map((im) => im.key)])
  }

  const addFromPool = (index: number, keys: string[]) => {
    const current = rows[index].imageKeys
    const next = [...current, ...keys.filter((k) => !current.includes(k))].slice(0, MAX_VARIANT_IMAGES)
    setKeys(index, next)
  }

  const removeImageKey = (index: number, key: string) => setKeys(index, rows[index].imageKeys.filter((k) => k !== key))

  const moveImageKey = (index: number, from: number, to: number) => {
    const list = rows[index].imageKeys
    if (from === to || to < 0 || to >= list.length) return
    const next = [...list]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setKeys(index, next)
  }

  const poolByKey = new Map(pool.map((im) => [im.key, im]))

  const applyBulk = () => {
    if (bulkPrice === "" && bulkStock === "") return
    onChange({
      ...value,
      rows: rows.map((r) => ({
        ...r,
        ...(bulkPrice !== "" ? { price: bulkPrice } : {}),
        ...(bulkStock !== "" ? { inventoryQuantity: bulkStock } : {}),
      })),
    })
    setBulkPrice("")
    setBulkStock("")
  }

  const validCount = usableOptions(options).length
  const excludedCount = excluded.filter((e) => usableOptions(options).every((o) => o.values.includes(e[o.name.trim()]))).length

  return (
    <div className="space-y-4">
      {/* Options */}
      <div className="space-y-3">
        {options.map((opt, i) => (
          <div key={i} className="grid grid-cols-1 md:grid-cols-[14rem_1fr_auto] gap-3 items-start p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Option name</label>
              <OptionNameInput
                name={opt.name}
                hasValues={opt.values.length > 0}
                onCommit={(name) => setOptionName(i, name)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Values</label>
              <div className="flex flex-wrap items-center gap-2 min-h-[38px] px-2 py-1.5 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-lg bg-white">
                {opt.values.map((v) => (
                  <span key={v} className="inline-flex items-center gap-1 rounded-md bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-medium pl-2 pr-1 py-1">
                    {v}
                    <button type="button" aria-label={`Remove ${v}`} onClick={() => removeValue(i, v)} className="p-0.5 rounded hover:bg-primary-100 dark:hover:bg-primary-800">
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <input
                  placeholder={opt.values.length ? "Add value" : "Type a value and press Enter (comma for several)"}
                  value={valueInputs[i] || ""}
                  onChange={(e) => setValueInputs((p) => ({ ...p, [i]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addValue(i) } }}
                  onBlur={() => addValue(i)}
                  className="flex-1 min-w-[10rem] bg-transparent text-sm text-gray-900 dark:text-gray-100 focus:outline-none py-0.5"
                />
              </div>
            </div>
            <button type="button" onClick={() => removeOption(i)} aria-label="Remove option" className="md:mt-6 p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 justify-self-start">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {options.length < MAX_OPTIONS && (
          <button type="button" onClick={addOption} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline">
            <Plus size={14} /> Add another option
          </button>
        )}
      </div>

      {/* Variants table */}
      {validCount > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Variants ({rows.length})</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">Combinations are generated from the options. Remove the ones you don&apos;t sell.</p>
            </div>
            {rows.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <input type="number" step="0.01" min="0" placeholder="Price for all" value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)} className={`${inputCls} w-32`} />
                <input type="number" min="0" step="1" placeholder="Stock for all" value={bulkStock} onChange={(e) => setBulkStock(e.target.value)} className={`${inputCls} w-32`} />
                <button type="button" onClick={applyBulk} disabled={bulkPrice === "" && bulkStock === ""} className="px-3 py-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50 disabled:opacity-50">
                  Apply to all
                </button>
              </div>
            )}
          </div>

          {rows.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-600 dark:text-gray-400">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Variant</th>
                    <th className="px-3 py-2 text-left font-medium min-w-[10rem]">SKU</th>
                    <th className="px-3 py-2 text-left font-medium min-w-[7rem]">Price (Rs.)</th>
                    <th className="px-3 py-2 text-left font-medium min-w-[6rem]">Stock</th>
                    <th className="px-3 py-2 text-left font-medium min-w-[14rem]">Images</th>
                    <th className="px-3 py-2 text-center font-medium">Active</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {rows.map((r, i) => (
                    <tr key={r.id || combinationKey(options, r.options)} className={r.isActive ? "" : "opacity-60"}>
                      <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">{combinationLabel(options, r.options)}</td>
                      <td className="px-3 py-2"><input value={r.sku} onChange={(e) => updateRow(i, { sku: e.target.value })} className={cellInputCls} /></td>
                      <td className="px-3 py-2"><input type="number" step="0.01" min="0" value={r.price} onChange={(e) => updateRow(i, { price: e.target.value })} className={cellInputCls} /></td>
                      <td className="px-3 py-2"><input type="number" step="1" min="0" value={r.inventoryQuantity} onChange={(e) => updateRow(i, { inventoryQuantity: e.target.value })} className={cellInputCls} /></td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {r.imageKeys.map((key, n) => {
                            const im = poolByKey.get(key)
                            if (!im) return null
                            return (
                              <div
                                key={key}
                                draggable
                                onDragStart={() => setDragImg({ row: i, index: n })}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => { if (dragImg && dragImg.row === i) moveImageKey(i, dragImg.index, n); setDragImg(null) }}
                                onDragEnd={() => setDragImg(null)}
                                className={`relative group w-12 h-12 rounded border overflow-hidden bg-gray-50 dark:bg-gray-800 cursor-move ${n === 0 ? "border-primary-500 ring-1 ring-primary-500" : "border-gray-200 dark:border-gray-700"} ${dragImg?.row === i && dragImg.index === n ? "opacity-40" : ""}`}
                              >
                                <img src={im.src} alt="" className="w-full h-full object-cover pointer-events-none" />
                                <span className="absolute top-0 left-0 bg-black/60 text-white text-[8px] leading-none px-1 py-0.5 rounded-br">{n === 0 ? "Main" : n + 1}</span>
                                <button type="button" aria-label="Remove image from this variant" onClick={() => removeImageKey(i, key)} className="absolute top-0 right-0 bg-white/90 dark:bg-gray-800/90 text-gray-600 dark:text-gray-300 hover:text-red-500 p-0.5 rounded-bl"><X size={10} /></button>
                                <div className="absolute bottom-0 inset-x-0 flex justify-between bg-black/55 text-white">
                                  <button type="button" aria-label="Move earlier" disabled={n === 0} onClick={() => moveImageKey(i, n, n - 1)} className="px-1.5 text-[10px] leading-4 disabled:opacity-30">◀</button>
                                  <button type="button" aria-label="Move later" disabled={n === r.imageKeys.length - 1} onClick={() => moveImageKey(i, n, n + 1)} className="px-1.5 text-[10px] leading-4 disabled:opacity-30">▶</button>
                                </div>
                              </div>
                            )
                          })}
                          {r.imageKeys.length < MAX_VARIANT_IMAGES && (
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setImageMenu(imageMenu === i ? null : i)}
                                className="w-12 h-12 rounded border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center gap-0.5 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition text-gray-400 dark:text-gray-500"
                                aria-haspopup="menu"
                                aria-expanded={imageMenu === i}
                              >
                                <ImagePlus size={14} />
                                <span className="text-[9px] leading-none">Add</span>
                              </button>
                              {imageMenu === i && (
                                <>
                                  <div className="fixed inset-0 z-10" onClick={() => setImageMenu(null)} />
                                  <div role="menu" className="absolute left-0 top-full mt-1 z-20 w-52 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg py-1 text-sm">
                                    <button
                                      type="button" role="menuitem"
                                      disabled={pool.length === 0}
                                      onClick={() => { setImageMenu(null); setPicker({ row: i, picked: [] }) }}
                                      className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                      From product images
                                      {pool.length === 0 && <span className="block text-[11px] text-gray-400">No product images yet</span>}
                                    </button>
                                    <label role="menuitem" className="block px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200 cursor-pointer">
                                      From my device
                                      <input
                                        type="file" accept="image/*" multiple className="hidden"
                                        onChange={(e) => { const f = Array.from(e.target.files || []); e.target.value = ""; setImageMenu(null); addFromDevice(i, f) }}
                                      />
                                    </label>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={r.isActive} onChange={(e) => updateRow(i, { isActive: e.target.checked })} className="w-4 h-4 accent-primary-600" aria-label="Active" />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button type="button" onClick={() => excludeRow(i)} aria-label="Remove variant" title="Remove this combination" className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">All combinations are removed.</p>
          )}

          {excludedCount > 0 && (
            <button type="button" onClick={restoreExcluded} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline">
              <RotateCcw size={12} /> Restore {excludedCount} removed combination{excludedCount > 1 ? "s" : ""}
            </button>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Each variant has its own images (up to {MAX_VARIANT_IMAGES}) chosen from the product images or added from your device; images added from your device also join the product images. Drag or use the arrows to set the order customers see; the first is the main one. Customers see only the selected variant&apos;s images, or all product images if a variant has none. Inactive variants stay saved but customers can&apos;t buy them.
          </p>
        </div>
      )}
      {picker && (() => {
        const row = rows[picker.row]
        const taken = new Set(row?.imageKeys || [])
        const available = pool.filter((im) => !taken.has(im.key))
        const room = MAX_VARIANT_IMAGES - (row?.imageKeys.length || 0)
        const toggle = (key: string) =>
          setPicker((p) => {
            if (!p) return p
            if (p.picked.includes(key)) return { ...p, picked: p.picked.filter((k) => k !== key) }
            return p.picked.length >= room ? p : { ...p, picked: [...p.picked, key] }
          })
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPicker(null)}>
            <div className="w-full max-w-lg rounded-xl bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">Choose from product images</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{row ? combinationLabel(options, row.options) : ""} · {picker.picked.length} selected · room for {room}</p>
                </div>
                <button type="button" onClick={() => setPicker(null)} aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X size={18} /></button>
              </div>
              <div className="p-5 max-h-[60vh] overflow-y-auto">
                {available.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Every product image is already used by this variant. Add more from your device.</p>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                    {available.map((im) => {
                      const on = picker.picked.includes(im.key)
                      return (
                        <button
                          key={im.key}
                          type="button"
                          onClick={() => toggle(im.key)}
                          aria-pressed={on}
                          className={`relative aspect-square rounded-lg border-2 overflow-hidden bg-gray-50 dark:bg-gray-800 ${on ? "border-primary-600 ring-2 ring-primary-200" : "border-gray-200 dark:border-gray-700 hover:border-gray-300"}`}
                        >
                          <img src={im.src} alt="" className="w-full h-full object-cover" />
                          {on && <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary-600 text-white text-xs flex items-center justify-center font-bold">{picker.picked.indexOf(im.key) + 1}</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 px-5 py-3 border-t border-gray-100 dark:border-gray-800">
                <button type="button" onClick={() => setPicker(null)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg">Cancel</button>
                <button
                  type="button"
                  disabled={picker.picked.length === 0}
                  onClick={() => { addFromPool(picker.row, picker.picked); setPicker(null) }}
                  className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  Add {picker.picked.length > 0 ? picker.picked.length : ""} image{picker.picked.length === 1 ? "" : "s"}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
