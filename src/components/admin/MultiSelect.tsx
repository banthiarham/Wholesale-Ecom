"use client";

import React, { useState, useMemo } from "react";

export interface MultiSelectItem {
  id: string;
  label: string;
  subtitle?: string;
  image?: string;
}

export interface MultiSelectProps {
  label: string;
  items: MultiSelectItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  mode?: "inline" | "modal";
  searchable?: boolean;
  maxHeight?: number;
  maxSelections?: number;
  disabled?: boolean;
}

export default function MultiSelect({
  label,
  items,
  selectedIds,
  onChange,
  mode = "inline",
  searchable = false,
  maxHeight,
  maxSelections,
  disabled = false,
}: MultiSelectProps) {
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q))
    );
  }, [items, search]);

  const toggleItem = (id: string) => {
    if (disabled) return;
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((sid) => sid !== id));
    } else {
      if (maxSelections && selectedIds.length >= maxSelections) {
        // Replace the last selection if maxSelections is 1 (single-select behavior)
        if (maxSelections === 1) {
          onChange([id]);
        }
        return;
      }
      onChange([...selectedIds, id]);
    }
  };

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.includes(item.id)),
    [items, selectedIds]
  );

  if (mode === "modal") {
    return (
      <>
        {/* Trigger button */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            {label}
            {selectedIds.length > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                {selectedIds.length} selected
              </span>
            )}
          </label>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setModalOpen(true)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
          >
            {selectedIds.length === 0
              ? `Select ${label.toLowerCase()}...`
              : selectedItems.map((s) => s.label).join(", ")}
          </button>
        </div>

        {/* Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="mx-4 w-full max-w-lg rounded-lg bg-white shadow-xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  Select {label}
                </h3>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-md p-1 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              {/* Search */}
              {searchable && (
                <div className="border-b px-4 py-2">
                  <input
                    type="text"
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              )}

              {/* Items list */}
              <div
                className="max-h-72 overflow-y-auto p-2"
                style={{ maxHeight: maxHeight ? `${maxHeight}px` : undefined }}
              >
                {filteredItems.length === 0 && (
                  <p className="px-2 py-4 text-center text-sm text-gray-500">
                    No items found
                  </p>
                )}
                {filteredItems.map((item) => (
                  <label
                    key={item.id}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleItem(item.id)}
                      disabled={disabled}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    {item.image && (
                      <img
                        src={item.image}
                        alt={item.label}
                        className="h-8 w-8 rounded object-cover"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {item.label}
                      </p>
                      {item.subtitle && (
                        <p className="truncate text-xs text-gray-500">
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </label>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t px-4 py-3">
                <span className="text-sm text-gray-500">
                  {selectedIds.length} selected
                  {maxSelections ? ` (max ${maxSelections})` : ""}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onChange([]);
                      setSearch("");
                    }}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModalOpen(false);
                      setSearch("");
                    }}
                    className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Inline mode (default)
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {selectedIds.length > 0 && (
          <span className="ml-2 inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
            {selectedIds.length} selected
          </span>
        )}
      </label>

      {/* Search input for inline mode */}
      {searchable && (
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      )}

      {/* Scrollable checkbox list */}
      <div
        className="overflow-y-auto rounded-md border border-gray-200 bg-white"
        style={{ maxHeight: maxHeight ? `${maxHeight}px` : "160px" }}
      >
        {filteredItems.length === 0 && (
          <p className="px-3 py-4 text-center text-sm text-gray-500">
            No items found
          </p>
        )}
        {filteredItems.map((item) => (
          <label
            key={item.id}
            className="flex cursor-pointer items-center gap-2 border-b border-gray-50 px-3 py-1.5 last:border-0 hover:bg-gray-50"
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(item.id)}
              onChange={() => toggleItem(item.id)}
              disabled={disabled}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <div className="flex-1 min-w-0">
              <span className="truncate text-sm text-gray-900">{item.label}</span>
              {item.subtitle && (
                <span className="ml-2 text-xs text-gray-500">
                  {item.subtitle}
                </span>
              )}
            </div>
          </label>
        ))}
      </div>

      {/* Selected pills */}
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {selectedItems.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
            >
              {item.label}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => toggleItem(item.id)}
                  className="ml-0.5 text-indigo-400 hover:text-indigo-600"
                >
                  ✕
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}