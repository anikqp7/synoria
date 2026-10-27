"use client";
import { useEffect } from 'react';
// Start after the commit, and cancel initialization for Strict Mode probe mounts
// or routes replaced before their first microtask. Manual refresh stays immediate.
export default function useInitialLoad(load, enabled = true) {
  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => { if (mounted && enabled) load(); });
    return () => { mounted = false; };
  }, [load, enabled]);
}
