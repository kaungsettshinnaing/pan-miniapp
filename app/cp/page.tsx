"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────
type Merchant = {
  merchantURL: string;
  merchantName: string;
  outletName: string | null;
  merchantTelegramID: string;
  active: boolean;
  earnType: string;
  earnValue: number;
  commissionType: string;
  commissionValue: number;
  subscriptionFee: number;
  rebateValidityDays: number;
  _count: { purchases: number };
};

type Purchase = {
  id: string;
  merchantURL: string;
  customerTelegramID: string;
  amount: number;
  rebateDeducted: number;
  commissionEarned: number;
  createdAt: string;
  merchant: { merchantName: string };
  customer: { firstName: string | null; username: string | null };
};

type EarningsMonth = { month: string; commission: number; myShare: number };
type Earnings = { months: EarningsMonth[]; totalCommission: number; myShare: number; profitSharePct: number };

// ── apiFetch ─────────────────────────────────────────────────────────────────
async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error ?? "Request failed");
  return json.data as T;
}

function fmtKs(n: number) { return `Ks ${n.toLocaleString()}`; }
function fmtPct(n: number) { return `${n}%`; }

// ── Blank merchant form ───────────────────────────────────────────────────────
const BLANK_FORM = {
  merchantURL: "", merchantName: "", outletName: "", merchantTelegramID: "",
  earnType: "PERCENTAGE", earnValue: "10",
  commissionType: "PERCENTAGE", commissionValue: "0",
  subscriptionFee: "0", rebateValidityDays: "14",
};

export default function CPPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [tab, setTab] = useState<"merchants" | "activity" | "earnings">("merchants");

  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [activity, setActivity] = useState<Purchase[]>([]);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editMerchant, setEditMerchant] = useState<Merchant | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [formSaving, setFormSaving] = useState(false);

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    try {
      const me = await fetch("/api/auth/me").then(r => r.json());
      if (!me.ok || me.data?.role !== "CHANNEL_PARTNER") { router.push("/login"); return; }
      setUsername(me.data.username);
      await load();
    } catch {
      router.push("/login");
    }
  }

  async function load() {
    setLoading(true); setError(null);
    try {
      const [m, a, e] = await Promise.all([
        apiFetch<Merchant[]>("/api/cp/merchants"),
        apiFetch<Purchase[]>("/api/cp/activity?limit=50"),
        apiFetch<Earnings>("/api/cp/earnings"),
      ]);
      setMerchants(m); setActivity(a); setEarnings(e);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  async function saveEdit() {
    if (!editMerchant) return;
    setEditSaving(true);
    try {
      await apiFetch("/api/cp/merchants", { method: "PATCH", body: JSON.stringify(editMerchant) });
      setEditMerchant(null); await load();
    } catch (e) { alert(e instanceof Error ? e.message : "Save failed"); }
    finally { setEditSaving(false); }
  }

  async function saveOnboard() {
    setFormSaving(true);
    try {
      await apiFetch("/api/cp/merchants", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          earnValue: Number(form.earnValue),
          commissionValue: Number(form.commissionValue),
          subscriptionFee: Number(form.subscriptionFee),
          rebateValidityDays: Number(form.rebateValidityDays),
        }),
      });
      setOnboardOpen(false); setForm(BLANK_FORM); await load();
    } catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
    finally { setFormSaving(false); }
  }

  if (loading) return (
    <main className="max-w-[480px] mx-auto min-h-screen bg-pan-navy px-4 pt-6">
      <div className="animate-pulse space-y-3">{[1,2,3].map(i=><div key={i} className="h-14 rounded-xl bg-pan-card"/>)}</div>
    </main>
  );

  if (error) return (
    <main className="max-w-[480px] mx-auto min-h-screen bg-pan-navy px-4 pt-10 text-center">
      <p className="text-pan-pink mb-3">{error}</p>
      <button onClick={load} className="text-pan-muted text-sm underline">Retry</button>
    </main>
  );

  const totalPurchases = merchants.reduce((s, m) => s + m._count.purchases, 0);

  return (
    <main className="max-w-[480px] mx-auto min-h-screen bg-pan-navy px-4 pt-4 pb-24">

      {/* Header */}
      <header className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-pan-card flex items-center justify-center text-sm font-black text-pan-pink">
          {username[0]?.toUpperCase()}
        </div>
        <div className="flex-1">
          <p className="text-white font-black text-sm">{username}</p>
          <p className="text-pan-muted text-xs">Channel Partner</p>
        </div>
        <button onClick={logout} className="text-pan-muted text-xs border border-pan-border rounded-lg px-3 py-1.5 cursor-pointer">
          Sign out
        </button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: "Merchants", value: merchants.length },
          { label: "Redemptions", value: totalPurchases },
          { label: `My Share (${earnings?.profitSharePct ?? 0}%)`, value: earnings ? fmtKs(Math.round(earnings.myShare)) : "—" },
        ].map(s => (
          <div key={s.label} className="rounded-xl bg-pan-card border border-pan-border p-3 text-center">
            <p className="text-white font-black text-base">{s.value}</p>
            <p className="text-pan-muted text-[10px] mt-0.5 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex bg-pan-card rounded-xl p-1 mb-4">
        {(["merchants", "activity", "earnings"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors capitalize"
            style={tab === t ? { background: "#f0206a", color: "#fff" } : { color: "#6b7fb0" }}>
            {t === "merchants" ? "🏪 Merchants" : t === "activity" ? "📋 Activity" : "💰 Earnings"}
          </button>
        ))}
      </div>

      {/* ── Merchants tab ── */}
      {tab === "merchants" && (
        <div className="space-y-3">
          <button onClick={() => setOnboardOpen(true)}
            className="w-full rounded-xl py-3 text-sm font-bold text-white cursor-pointer"
            style={{ background: "linear-gradient(135deg,#f0206a,#c01253)" }}>
            + Onboard Merchant
          </button>
          {merchants.map(m => (
            <div key={m.merchantURL} className="rounded-xl bg-pan-card border border-pan-border p-4">
              <div className="flex justify-between items-start mb-1">
                <div>
                  <p className="text-white font-bold">{m.merchantName}</p>
                  {m.outletName && <p className="text-pan-muted text-xs">{m.outletName}</p>}
                  <p className="text-pan-muted text-xs">{m.merchantURL}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${m.active ? "bg-green-900 text-green-400" : "bg-red-900/40 text-pan-pink"}`}>
                  {m.active ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="text-pan-muted text-xs mb-3">
                Earn: {m.earnType === "PERCENTAGE" ? fmtPct(m.earnValue) : fmtKs(m.earnValue)}
                {" · "}Commission: {m.commissionType === "PERCENTAGE" ? fmtPct(m.commissionValue) : fmtKs(m.commissionValue)}
                {" · "}{m._count.purchases} redemptions
              </p>
              <button onClick={() => setEditMerchant({ ...m })}
                className="w-full rounded-lg py-2 text-xs font-bold text-pan-muted border border-pan-border cursor-pointer">
                Edit settings →
              </button>
            </div>
          ))}
          {merchants.length === 0 && <p className="text-center text-pan-muted text-sm py-6">No merchants yet — onboard your first one.</p>}
        </div>
      )}

      {/* ── Activity tab ── */}
      {tab === "activity" && (
        <div className="space-y-2">
          {activity.map(p => (
            <div key={p.id} className="rounded-xl bg-pan-card border border-pan-border px-4 py-3 flex justify-between items-center">
              <div>
                <p className="text-white text-sm font-bold">{p.merchant.merchantName}</p>
                <p className="text-pan-muted text-xs">
                  {p.customer.firstName ?? p.customer.username ?? p.customerTelegramID}
                  {" · "}
                  {new Date(p.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-white text-sm font-bold">{fmtKs(p.amount)}</p>
                <p className="text-pan-muted text-xs">commission {fmtKs(Math.round(p.commissionEarned))}</p>
              </div>
            </div>
          ))}
          {activity.length === 0 && <p className="text-center text-pan-muted text-sm py-6">No activity yet.</p>}
        </div>
      )}

      {/* ── Earnings tab ── */}
      {tab === "earnings" && earnings && (
        <div className="space-y-3">
          <div className="rounded-xl bg-pan-card border border-pan-border p-4">
            <p className="text-pan-muted text-xs uppercase tracking-widest font-bold mb-3">All-time summary</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-pan-muted text-xs mb-0.5">Total commission</p>
                <p className="text-white font-black">{fmtKs(Math.round(earnings.totalCommission))}</p>
              </div>
              <div>
                <p className="text-pan-muted text-xs mb-0.5">My share ({earnings.profitSharePct}%)</p>
                <p className="font-black" style={{ color: "#f0b429" }}>{fmtKs(Math.round(earnings.myShare))}</p>
              </div>
            </div>
          </div>
          {earnings.months.map(m => (
            <div key={m.month} className="rounded-xl bg-pan-card border border-pan-border px-4 py-3 flex justify-between items-center">
              <div>
                <p className="text-white font-bold">{m.month}</p>
                <p className="text-pan-muted text-xs">commission {fmtKs(Math.round(m.commission))}</p>
              </div>
              <p className="font-bold text-sm" style={{ color: "#f0b429" }}>{fmtKs(Math.round(m.myShare))}</p>
            </div>
          ))}
          {earnings.months.length === 0 && <p className="text-center text-pan-muted text-sm py-4">No earnings yet.</p>}
        </div>
      )}

      {/* ── Edit merchant sheet ── */}
      {editMerchant && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setEditMerchant(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 max-w-[480px] mx-auto rounded-t-2xl bg-pan-overlay px-5 pt-4 pb-10 shadow-2xl overflow-y-auto max-h-[85vh]">
            <div className="mx-auto mb-4 w-10 h-1 rounded-full bg-pan-border" />
            <h2 className="text-lg font-bold text-white mb-4">Edit — {editMerchant.merchantName}</h2>
            {([
              { label: "Merchant Name", field: "merchantName", type: "text" },
              { label: "Outlet Name", field: "outletName", type: "text" },
              { label: "Telegram ID (cashier)", field: "merchantTelegramID", type: "text" },
              { label: "Earn Value", field: "earnValue", type: "number" },
              { label: "Commission Value", field: "commissionValue", type: "number" },
              { label: "Subscription Fee (Ks)", field: "subscriptionFee", type: "number" },
              { label: "Rebate Validity (days)", field: "rebateValidityDays", type: "number" },
            ] as const).map(({ label, field, type }) => (
              <div key={field} className="mb-4">
                <p className="text-pan-muted text-xs uppercase tracking-widest font-bold mb-1">{label}</p>
                <input type={type}
                  value={(editMerchant as Record<string, unknown>)[field] as string ?? ""}
                  onChange={e => setEditMerchant({ ...editMerchant, [field]: type === "number" ? Number(e.target.value) : e.target.value })}
                  className="w-full bg-pan-card border border-pan-border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-pan-pink" />
              </div>
            ))}
            <div className="mb-5">
              <p className="text-pan-muted text-xs uppercase tracking-widest font-bold mb-1">Status</p>
              <button onClick={() => setEditMerchant({ ...editMerchant, active: !editMerchant.active })}
                className={`px-4 py-2 rounded-lg text-sm font-bold cursor-pointer ${editMerchant.active ? "bg-green-900 text-green-400" : "bg-red-900/40 text-pan-pink"}`}>
                {editMerchant.active ? "Active — tap to deactivate" : "Inactive — tap to activate"}
              </button>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditMerchant(null)} className="flex-1 rounded-xl py-3 text-sm font-bold text-pan-muted border border-pan-border cursor-pointer">Cancel</button>
              <button onClick={saveEdit} disabled={editSaving}
                className="flex-1 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-40 cursor-pointer"
                style={{ background: "linear-gradient(135deg,#f0206a,#c01253)" }}>
                {editSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Onboard merchant sheet ── */}
      {onboardOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setOnboardOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 max-w-[480px] mx-auto rounded-t-2xl bg-pan-overlay px-5 pt-4 pb-10 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="mx-auto mb-4 w-10 h-1 rounded-full bg-pan-border" />
            <h2 className="text-lg font-bold text-white mb-4">Onboard Merchant</h2>
            {([
              { label: "Merchant URL (unique ID / slug)", field: "merchantURL", type: "text", hint: "e.g. MyShop — used in QR code" },
              { label: "Business Name", field: "merchantName", type: "text" },
              { label: "Outlet Name (optional)", field: "outletName", type: "text" },
              { label: "Cashier Telegram ID (optional)", field: "merchantTelegramID", type: "text" },
            ] as const).map(({ label, field, type }) => (
              <div key={field} className="mb-4">
                <p className="text-pan-muted text-xs uppercase tracking-widest font-bold mb-1">{label}</p>
                {field === "merchantURL" && <p className="text-pan-muted text-[10px] mb-1">e.g. MyShop — used in QR code</p>}
                {field === "merchantTelegramID" && <p className="text-pan-muted text-[10px] mb-1">Can be set later</p>}
                <input type={type} value={form[field]}
                  onChange={e => setForm({ ...form, [field]: e.target.value })}
                  autoCapitalize="none"
                  className="w-full bg-pan-card border border-pan-border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-pan-pink" />
              </div>
            ))}

            {/* Earn type */}
            <div className="mb-4">
              <p className="text-pan-muted text-xs uppercase tracking-widest font-bold mb-2">Cashback Type</p>
              <div className="flex gap-2 mb-2">
                {["PERCENTAGE", "FIXED"].map(t => (
                  <button key={t} onClick={() => setForm({ ...form, earnType: t })}
                    className="flex-1 py-2 rounded-lg text-xs font-bold cursor-pointer"
                    style={form.earnType === t ? { background: "#f0206a", color: "#fff" } : { background: "#1e2d5a", color: "#6b7fb0" }}>
                    {t === "PERCENTAGE" ? "% of purchase" : "Fixed Ks amount"}
                  </button>
                ))}
              </div>
              <input type="number" value={form.earnValue}
                onChange={e => setForm({ ...form, earnValue: e.target.value })}
                placeholder={form.earnType === "PERCENTAGE" ? "e.g. 10 for 10%" : "e.g. 500 for Ks 500"}
                className="w-full bg-pan-card border border-pan-border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-pan-pink" />
            </div>

            {/* Commission type */}
            <div className="mb-4">
              <p className="text-pan-muted text-xs uppercase tracking-widest font-bold mb-2">PAN Commission</p>
              <div className="flex gap-2 mb-2">
                {["PERCENTAGE", "FLAT"].map(t => (
                  <button key={t} onClick={() => setForm({ ...form, commissionType: t })}
                    className="flex-1 py-2 rounded-lg text-xs font-bold cursor-pointer"
                    style={form.commissionType === t ? { background: "#f0206a", color: "#fff" } : { background: "#1e2d5a", color: "#6b7fb0" }}>
                    {t === "PERCENTAGE" ? "% of sale" : "Flat Ks per txn"}
                  </button>
                ))}
              </div>
              <input type="number" value={form.commissionValue}
                onChange={e => setForm({ ...form, commissionValue: e.target.value })}
                placeholder="0"
                className="w-full bg-pan-card border border-pan-border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-pan-pink" />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <p className="text-pan-muted text-xs uppercase tracking-widest font-bold mb-1">Monthly Sub (Ks)</p>
                <input type="number" value={form.subscriptionFee}
                  onChange={e => setForm({ ...form, subscriptionFee: e.target.value })}
                  className="w-full bg-pan-card border border-pan-border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-pan-pink" />
              </div>
              <div>
                <p className="text-pan-muted text-xs uppercase tracking-widest font-bold mb-1">Cashback valid (days)</p>
                <input type="number" value={form.rebateValidityDays}
                  onChange={e => setForm({ ...form, rebateValidityDays: e.target.value })}
                  className="w-full bg-pan-card border border-pan-border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-pan-pink" />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setOnboardOpen(false)} className="flex-1 rounded-xl py-3 text-sm font-bold text-pan-muted border border-pan-border cursor-pointer">Cancel</button>
              <button onClick={saveOnboard} disabled={formSaving || !form.merchantURL || !form.merchantName || !form.earnValue}
                className="flex-1 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-40 cursor-pointer"
                style={{ background: "linear-gradient(135deg,#f0206a,#c01253)" }}>
                {formSaving ? "Creating…" : "Create Merchant"}
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
