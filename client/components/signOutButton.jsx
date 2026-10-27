"use client";

import Button from "@/components/button";
import { useState } from "react";
import { signOut } from "next-auth/react";

export default function SignOutButton({ collapsed = false }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    setBusy(true);
    setError("");
    try {
      await signOut({ callbackUrl: "/" });
    } catch {
      setError("Unable to sign out. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div>
      <Button variant="danger" appearance="ghost" size="small" onClick={logout} disabled={busy} aria-label={busy ? "Signing Out" : "Sign Out"} title={collapsed ? "Sign Out" : undefined} className={`w-full justify-start gap-3 ${collapsed ? "min-[761px]:justify-center min-[761px]:px-0" : ""}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="size-5 shrink-0" aria-hidden="true"><path d="M9 5H4v14h5M10 12h11m-4-4 4 4-4 4" /></svg>
        <span className={`${collapsed ? "min-[761px]:hidden" : ""}`}>{busy ? "Signing Out…" : "Sign Out"}</span>
      </Button>
      {error && <p role="alert" className="mt-2 text-[13px] leading-relaxed text-danger-text">{error}</p>}
    </div>
  );
}
