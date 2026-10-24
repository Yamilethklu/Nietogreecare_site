"use client";

import * as React from "react";
import Link from "next/link";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Isolated implicit-flow client: recovery links work across devices/browsers
// without relying on a PKCE verifier saved on the requesting device.
let recoveryClient: SupabaseClient | null = null;
function getRecoveryClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  if (!recoveryClient) recoveryClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { flowType: "implicit", storageKey: "nieto-password-recovery", persistSession: true, detectSessionInUrl: true, autoRefreshToken: false } },
  );
  return recoveryClient;
}

export default function ResetPasswordPage() {
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [ready, setReady] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState("");
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    const auth = getRecoveryClient()?.auth;
    if (!auth) { setNotice("Authentication is unavailable."); return; }
    const prepare = async () => {
      try {
        const query = new URLSearchParams(window.location.search);
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const error = query.get("error_description") || hash.get("error_description");
        if (error) throw new Error(error);
        const code = query.get("code");
        const tokenHash = query.get("token_hash");
        const token = hash.get("access_token");
        const refresh = hash.get("refresh_token");
        if (code) {
          throw new Error("This older recovery link requires the original browser. Please request a new link from this page.");
        } else if (tokenHash) {
          const { error } = await auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
          if (error) throw error;
        } else if (token && refresh) {
          const { error } = await auth.setSession({ access_token: token, refresh_token: refresh });
          if (error) throw error;
        }
        // The implicit client initializes the session from URL hash automatically.
        const { data: sessionData } = await auth.getSession();
        if (!tokenHash && !token && !sessionData.session) throw new Error("Request a recovery link to set your password.");
        const { data, error: userError } = await auth.getUser();
        if (userError || !data.user) throw new Error("This recovery link has expired or is invalid. Request a new link.");
        if (active) setReady(true);
        window.history.replaceState({}, "", "/auth/reset-password");
      } catch (error) {
        if (active) setNotice(error instanceof Error ? error.message : "Could not verify the recovery link.");
      }
    };
    void prepare();
    return () => { active = false; };
  }, []);

  const sendRecovery = async (event: React.FormEvent) => {
    event.preventDefault();
    const client = getRecoveryClient();
    if (!client) return;
    setBusy(true); setNotice("");
    const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/reset-password` });
    setNotice(error ? error.message : "If this address is registered, a recovery email has been sent.");
    setBusy(false);
  };
  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) return setNotice("Use at least 8 characters.");
    if (password !== confirm) return setNotice("Passwords do not match.");
    const client = getRecoveryClient();
    if (!client) return;
    setBusy(true); setNotice("");
    const { error } = await client.auth.updateUser({ password });
    if (error) setNotice(error.message);
    else { await client.auth.signOut(); setDone(true); setPassword(""); setConfirm(""); }
    setBusy(false);
  };
  return <main className="container flex min-h-dvh max-w-md items-center py-12">
    <section className="w-full rounded-2xl border border-forest-200 bg-white p-7 shadow-xl">
      <h1 className="text-2xl font-semibold text-forest-950">Reset password</h1>
      <p className="mt-2 text-sm text-forest-800">Set a new password for your existing account. Google sign-in will remain available.</p>
      {notice && <p role="status" className="mt-4 text-sm text-red-700">{notice}</p>}
      {done ? <div className="mt-6 space-y-4"><p className="text-sm text-forest-950">Password updated successfully.</p><Link className="underline" href="/admin">Return to sign in</Link></div>
      : ready ? <form onSubmit={savePassword} className="mt-6 space-y-4">
        <label className="block text-sm text-forest-950">New password<input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 w-full rounded-lg border p-3 text-black"/></label>
        <label className="block text-sm text-forest-950">Confirm password<input type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={e=>setConfirm(e.target.value)} className="mt-1 w-full rounded-lg border p-3 text-black"/></label>
        <button disabled={busy} className="w-full rounded-full bg-green-500 p-3 font-semibold text-black">{busy ? "Saving…" : "Save new password"}</button>
      </form> : <form onSubmit={sendRecovery} className="mt-6 space-y-4">
        <p className="text-sm text-forest-950">Request a new recovery link if the previous one has expired.</p>
        <label className="block text-sm text-forest-950">Email address<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 w-full rounded-lg border p-3 text-black"/></label>
        <button disabled={busy} className="w-full rounded-full bg-green-500 p-3 font-semibold text-black">{busy ? "Sending…" : "Send recovery email"}</button>
      </form>}
      <Link href="/admin" className="mt-6 block text-center text-sm text-forest-900 underline">Back to admin sign in</Link>
    </section>
  </main>;
}
