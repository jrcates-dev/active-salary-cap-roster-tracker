"use client";

import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Hover tooltip that follows the pointer. Wrap any mark: the hit target is the
 * wrapper, so keep it at least as large as the mark it describes.
 */
export function Tip({
  content,
  children,
  className,
  style,
  as: Tag = "div",
}: {
  content: ReactNode;
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  as?: "div" | "span" | "td";
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  return (
    <Tag
      className={className}
      style={style}
      onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setPos(null)}
    >
      {children}
      {pos &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-50 max-w-xs rounded-md border border-border bg-panel-raised px-3 py-2 text-sm text-fg shadow-none"
            style={{
              left: Math.min(pos.x + 14, window.innerWidth - 300),
              top: pos.y + 16,
            }}
          >
            {content}
          </div>,
          document.body,
        )}
    </Tag>
  );
}

export function TipRow({ label, value, swatch }: { label: string; value: string; swatch?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className="flex items-center gap-2 text-fg-muted">
        {swatch}
        {label}
      </span>
      <span className="num text-base text-fg">{value}</span>
    </div>
  );
}
