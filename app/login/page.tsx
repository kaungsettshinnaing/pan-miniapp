"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();
      if (!json.ok) { setError(json.error ?? "Login failed"); return; }
      const { role } = json.data as { role: string };
      router.push(role === "ADMIN" ? "/admin" : "/");
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-[480px] mx-auto min-h-screen bg-pan-navy flex flex-col justify-center px-6 py-10">
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-pan-card flex items-center justify-center text-3xl font-black text-pan-pink mb-3">
          ပ
        </div>
        <p className="text-white text-xl font-black">PAN Platform</p>
        <p className="text-pan-muted text-sm">ပြန်အမ်းငွေ — Cashback</p>
      </div>

      {/* Form */}
      <div className="rounded-2xl bg-pan-card border border-pan-border p-6">
        <h1 className="text-white font-bold text-lg mb-5">Sign In</h1>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-pan-muted text-xs uppercase tracking-widest font-bold block mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              autoCapitalize="none"
              autoCorrect="off"
              required
              className="w-full bg-pan-navy border border-pan-border rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-pan-pink transition-colors"
            />
          </div>
          <div>
            <label className="text-pan-muted text-xs uppercase tracking-widest font-bold block mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              className="w-full bg-pan-navy border border-pan-border rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-pan-pink transition-colors"
            />
          </div>

          {error && (
            <p className="text-pan-pink text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full rounded-xl py-3 font-bold text-white disabled:opacity-40 cursor-pointer active:opacity-80 transition-opacity"
            style={{ background: "linear-gradient(135deg, #f0206a 0%, #c01253 100%)" }}
          >
            {loading ? "Signing in…" : "Sign In →"}
          </button>
        </form>
      </div>

      <p className="text-center text-pan-muted text-xs mt-6">
        cashbackapp.cloud · PAN Loyalty Platform
      </p>
    </main>
  );
}
