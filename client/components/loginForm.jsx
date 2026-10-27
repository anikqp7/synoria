"use client";
import { Form, Input } from '@/components/validatedForm';

import Link from "next/link";
import BrandLogo from "@/components/brandLogo";
import Button from "@/components/button";
import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { dashboardForRole, roleDefinitions } from "@/lib/roles";

export default function LoginForm({ role }) {
  const isMember = role !== "department";
  const roleLabel = role === "department" ? "Department / Coordinator" : roleDefinitions[role].label;
  const dashboard = dashboardForRole(role);
  const [mode, setMode] = useState("login");
  const router = useRouter();
  const { data: session, status } = useSession();
  const checking = status !== "unauthenticated";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const registering = !isMember && mode === "register";

  useEffect(() => {
    if (status === "authenticated") router.replace(dashboardForRole(session.user.role));
  }, [status, session, router]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    if (registering && fields.password !== fields.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const result = await signIn("credentials", {
        ...fields,
        role,
        intent: registering ? "register" : "login",
        redirect: false,
        callbackUrl: dashboard,
      });
      if (!result || result.error) {
        throw new Error(result?.error === "CredentialsSignin" ? "Email or password is incorrect." : result?.error || "Unable to sign in. Please try again.");
      }
      router.replace(dashboard);
      router.refresh();
    } catch (err) {
      setError(err.message === "Failed to fetch" ? "Unable to reach the server. Please try again." : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen grid-cols-[minmax(340px,44%)_1fr] max-[680px]:block">
      <aside className="relative flex flex-col overflow-hidden border-r border-border bg-primary-soft px-[11%] py-[42px] text-foreground min-[1450px]:pl-[17%] min-[1450px]:pr-[14%] max-[900px]:px-[9%] max-[900px]:py-[35px] max-[680px]:border-r-0 max-[680px]:border-b max-[680px]:p-6 [&_h1]:my-[27px] [&_h1]:mb-[25px] [&_h1]:text-[clamp(38px,4.1vw,60px)] [&_h1]:leading-[1.2] [&_h1]:font-semibold [&_h1]:tracking-[-1.9px] max-[900px]:[&_h1]:text-[42px] max-[680px]:[&_h1]:my-[18px] max-[680px]:[&_h1]:text-[32px] max-[680px]:[&_h1]:tracking-[-1px] max-[680px]:[&_h1_br]:hidden [&_em]:font-normal [&_em]:text-primary [&_em]:not-italic [&_p]:max-w-[340px] [&_p]:text-sm [&_p]:leading-[1.9] [&_p]:text-text-secondary max-[680px]:[&_p]:mb-0 max-[680px]:[&_p]:max-w-none max-[680px]:[&_p]:text-sm [&_footer]:flex [&_footer]:items-center [&_footer]:gap-[9px] [&_footer]:pt-[30px] [&_footer]:text-[13px] leading-relaxed [&_footer]:text-text-secondary max-[680px]:[&_footer]:hidden">
        <BrandLogo />
        <div className="my-auto pt-[65px] max-[680px]:pt-8">
          <span className="text-[13px] leading-relaxed font-bold tracking-[2px] text-primary max-[680px]:text-[13px] leading-relaxed">FINAL-YEAR PROJECT & THESIS SUPERVISION</span>
          <h1>Your project.<br />Your thesis.<br /><em>Faculty guidance.</em></h1>
          <p>A dedicated platform for university departments, faculty supervisors and final-year students working on projects and theses.</p>
          <div className="relative mx-auto mt-7 mb-[14px] h-[155px] w-[250px] opacity-80 max-[680px]:hidden" aria-hidden="true"><div className="absolute top-10 left-[15px] h-20 w-[210px] rounded-full border border-primary-border -rotate-30" /><div className="absolute top-10 left-[15px] h-20 w-[210px] rounded-full border border-primary-border rotate-30" /><div className="absolute top-10 left-[15px] h-20 w-[210px] rounded-full border border-primary-border rotate-90" /><span className="absolute top-[39px] left-[94px] text-[54px] text-primary">✳</span><span className="absolute top-[39px] left-[189px] size-2.5 rounded-full bg-primary" /></div>
        </div>
        
      </aside>
      <section className="flex min-w-0 flex-col gap-8 bg-surface-soft px-[6%] py-9 max-[900px]:px-[7%] max-[900px]:py-8 max-[680px]:gap-6 max-[680px]:px-4 max-[680px]:py-6">
        
        {checking ? <div className="m-auto w-full max-w-[460px] rounded-panel border border-border bg-surface p-8 shadow-panel max-[900px]:p-7 max-[680px]:px-5 max-[680px]:py-6 text-[13px] leading-relaxed text-text-secondary" role="status">Opening your workspace…</div> : (
          <div className="m-auto w-full max-w-[460px] rounded-panel border border-border bg-surface p-8 shadow-panel max-[900px]:p-7 max-[680px]:px-5 max-[680px]:py-6">
            <Link className="mb-[27px] block w-fit text-[13px] leading-relaxed text-primary no-underline hover:text-primary-active hover:underline [&+span]:mb-6 [&+span]:block" href="/">← Choose account type</Link>
            <span className="text-[13px] leading-relaxed font-bold tracking-[2px] text-primary">{roleLabel.toUpperCase()} ACCESS</span>
            {!isMember && <div className="mt-5 mb-7 flex gap-2 border-b border-border pb-2 [&_button]:rounded-control [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-[14px] [&_button]:py-2 [&_button]:text-[13px] leading-relaxed [&_button]:font-semibold [&_button]:text-text-secondary [&_button:enabled:hover]:bg-surface-hover [&_button:enabled:hover]:text-primary [&_button[aria-pressed=true]]:bg-primary-soft [&_button[aria-pressed=true]]:text-primary [&_button:disabled]:cursor-not-allowed [&_button:disabled]:text-disabled-text" aria-label="Account access"><button type="button" aria-pressed={!registering} disabled={busy} onClick={() => { setMode("login"); setError(""); setShowPassword(false); }}>Sign In</button><button type="button" aria-pressed={registering} disabled={busy} onClick={() => { setMode("register"); setError(""); setShowPassword(false); }}>Create Account</button></div>}
            <h2>{registering ? "A new chapter starts here." : "Welcome back."}</h2>
            <p className="mt-0 mb-[29px] text-[13px] leading-relaxed leading-[1.8] text-text-muted">{registering ? "Create your department’s account to get started." : isMember ? "Sign in with the account created by your department." : "Sign in to your department’s workspace."}</p>
            <Form key={mode} onSubmit={submit}>
              <fieldset disabled={busy}>
                {registering && <><label htmlFor="name">Department name</label><Input id="name" name="name" placeholder="e.g. Computer Science & Engineering" autoComplete="organization-title" required maxLength={120} /><label htmlFor="university">University name</label><Input id="university" name="university" placeholder="Enter your university name" autoComplete="organization" required maxLength={160} /></>}
                <label htmlFor="email">{roleLabel} email</label><Input id="email" name="email" type="email" placeholder={`${role}@university.edu`} autoComplete="username" required maxLength={254} />
                <label htmlFor="password">Password</label><div className="relative [&_input]:pr-[62px] [&_button]:absolute [&_button]:top-0 [&_button]:right-[13px] [&_button]:h-[42px] [&_button]:border-0 [&_button]:bg-transparent [&_button]:text-[13px] leading-relaxed [&_button]:text-primary [&_button:enabled:hover]:text-primary-active"><Input id="password" name="password" type={showPassword ? "text" : "password"} placeholder={registering ? "Create a strong password" : "Enter your password"} autoComplete={registering ? "new-password" : "current-password"} minLength={registering ? 8 : undefined} required /><button type="button" aria-label={showPassword ? "Hide Password" : "Show Password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Hide" : "Show"}</button></div>
                {registering && <><p className="mt-2 mb-0 text-[13px] leading-relaxed leading-[1.8] text-text-muted">Use at least 8 characters (maximum 72 bytes).</p><label htmlFor="confirmPassword">Confirm password</label><Input id="confirmPassword" name="confirmPassword" type={showPassword ? "text" : "password"} placeholder="Re-enter your password" autoComplete="new-password" required /></>}
                {error && <p className="mt-[18px] rounded-control border border-danger-border bg-danger-soft px-4 py-3 text-sm leading-[1.6] text-danger-text" role="alert">{error}</p>}
                <Button className="mt-6 w-full justify-center" type="submit">{busy ? (registering ? "Creating Account…" : "Signing In…") : (registering ? "Create Department Account" : "Sign In To Workspace")}</Button>
              </fieldset>
            </Form>
            {!isMember && <p className="mt-6 text-center text-sm text-text-muted [&_button]:border-0 [&_button]:bg-transparent [&_button]:p-1 [&_button]:text-sm [&_button]:font-semibold [&_button]:text-primary [&_button:enabled:hover]:text-primary-active [&_button:disabled]:cursor-not-allowed [&_button:disabled]:text-disabled-text">{registering ? "Already have a department account?" : "New to Synoria?"} <button disabled={busy} onClick={() => { setMode(registering ? "login" : "register"); setError(""); }}>{registering ? "Sign In" : "Create An Account"}</button></p>}
            <div className="mt-[34px] border-t border-border pt-5 text-center text-[13px] leading-relaxed leading-[1.8] text-text-muted [&_span]:mr-[5px]"><span aria-hidden="true">◇</span> {isMember ? `Your department creates and manages your ${role} account.` : "A dedicated account for your academic department."}</div>
          </div>
        )}
        
      </section>
    </main>
  );
}
