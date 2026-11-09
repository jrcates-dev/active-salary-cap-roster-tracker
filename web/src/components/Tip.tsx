"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Tooltip for any mark. A mouse shows it while hovering and it follows the pointer;
 * a tap shows it at the tap and a tap anywhere else hides it; keyboard focus on a
 * control inside the mark shows it beside the mark. Keep the wrapper at least as
 * large as the mark it describes.
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
  const ref = useRef<HTMLElement | null>(null);
  const touched = useRef(false);

  useEffect(() => {
    if (!pos) return;
    const close = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setPos(null);
    };
    const hide = () => setPos(null);
    document.addEventListener("pointerdown", close);
    window.addEventListener("scroll", hide, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("scroll", hide);
    };
  }, [pos]);

  const anchorTo = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setPos({ x: r.left + Math.min(r.width / 2, 40), y: r.bottom - 8 });
  };

  return (
    <Tag
      ref={ref as never}
      className={className}
      style={style}
      onPointerDown={(e) => {
        touched.current = e.pointerType !== "mouse";
      }}
      onMouseMove={(e) => {
        if (!touched.current) setPos({ x: e.clientX, y: e.clientY });
      }}
      onMouseLeave={() => {
        if (!touched.current) setPos(null);
      }}
      onClick={(e) => {
        if (touched.current) setPos({ x: e.clientX, y: e.clientY });
      }}
      onFocus={(e) => anchorTo(e.currentTarget as HTMLElement)}
      onBlur={() => setPos(null)}
    >
      {children}
      {pos &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-50 max-w-[280px] rounded-md bg-surface px-3 py-2 text-[13px] leading-snug text-ink shadow-pop"
            style={{
              left: Math.max(8, Math.min(pos.x + 14, window.innerWidth - 292)),
              top: Math.min(pos.y + 16, window.innerHeight - 180),
            }}
          >
            {content}
          </div>,
          document.body,
        )}
    </Tag>
  );
}

/** Tooltip heading. */
export function TipTitle({ children }: { children: ReactNode }) {
  return <div className="mb-1 font-semibold">{children}</div>;
}

/** One line of a tooltip: the value reads first, the label follows. */
export function TipRow({ label, value, swatch }: { label: ReactNode; value: ReactNode; swatch?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-5 py-px">
      <span className="flex items-center gap-2 text-ink-3">
        {swatch}
        {label}
      </span>
      <span className="num font-medium text-ink">{value}</span>
    </div>
  );
}
