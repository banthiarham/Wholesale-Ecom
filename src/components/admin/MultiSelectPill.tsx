"use client";

import React from "react";

export interface MultiSelectPillItem {
  id: string;
  label: string;
}

export interface MultiSelectPillProps {
  items: MultiSelectPillItem[];
  onRemove: (id: string) => void;
  color?: string;
}

export default function MultiSelectPill({
  items,
  onRemove,
  color = "indigo",
}: MultiSelectPillProps) {
  if (items.length === 0) return null;

  const colorClasses: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
    green: "bg-green-50 text-green-700 hover:bg-green-100",
    red: "bg-red-50 text-red-700 hover:bg-red-100",
    blue: "bg-blue-50 text-blue-700 hover:bg-blue-100",
    gray: "bg-gray-50 text-gray-700 hover:bg-gray-100",
  };

  const cls = colorClasses[color] || colorClasses.indigo;

  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <span
          key={item.id}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${cls}`}
        >
          {item.label}
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="ml-0.5 opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </span>
      ))}
    </div>
  );
}