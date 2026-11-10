"use client";

import { useCallback, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

/**
 * A view choice the reader made (a toggle, a tab, a sort, a zoomed group) that
 * should still be there when they come back: after following a chart into a roster
 * and pressing Back, or after a reload in the same tab. Kept in sessionStorage per
 * page, so it lasts for the visit, never leaks into the next one, and stays out of
 * the address (the roster's own filters live in the URL, which is shareable).
 *
 * The first render uses `initial`, as the server did, and the saved choice is put
 * back before the browser paints, so there is no flash of the default.
 */
export function useViewState<T>(
  key: string,
  initial: T,
  /** Rejects a saved value that no longer fits (a week or tab that is gone). */
  valid: (v: unknown) => boolean = () => true,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initial);
  const storeKey = useRef("");
  const check = useRef(valid);
  useLayoutEffect(() => {
    check.current = valid;
  });

  useLayoutEffect(() => {
    storeKey.current = `view:${window.location.pathname}:${key}`;
    const saved = read(storeKey.current);
    if (saved !== undefined && check.current(saved)) setValue(saved as T);
  }, [key]);

  const set = useCallback<Dispatch<SetStateAction<T>>>((next) => {
    setValue((prev) => {
      const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      if (storeKey.current) write(storeKey.current, v);
      return v;
    });
  }, []);

  return [value, set];
}

function read(k: string): unknown {
  try {
    const raw = window.sessionStorage.getItem(k);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function write(k: string, v: unknown) {
  try {
    window.sessionStorage.setItem(k, JSON.stringify(v));
  } catch {
    // Storage full or blocked (private mode): the choice just isn't remembered.
  }
}
