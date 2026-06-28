"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/app/page";

type Setting = { key: string; value: string };

type Merchant = {
  merchantURL: string;
  merchantName: string;
  outletName: string | null;
  merchantTelegramID: string;
  active: boolean;
  botToken: string | null;
  earnType: string;
  earnValue: number;
  commissionType: string;
  commissionValue: number;
  subscriptionFee: number;
  rebateValidityDays: number;
  redemptionGroupID: string | null;
  redemptionGroup: { groupName: string } | null;
};

const SETTING_LABELS: Record<string, string> = {
  N8N_WEBHOOK_URL: "n8n Webhook Base URL",
  DEFAULT_BOT_TOKEN: "Default Telegram Bot Token",
  CASHBACK_APP_NAME: "App Name",
};

export default function AdminPage() {
  const [tab, setTab] = useState<"settings" | "merchants">("settings");
  const [settings, setSettings] = useState<Setting[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [editMerchant, setEditMerchant] = useState<Merchant | null>(null);
  const [merchantSaving, setMerchantSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [s, m] = await Promise.all([
        apiFetch<Setting[]>("/api/admin/settings"),
        apiFetch<Merchant[]>("/api/admin/merchants"),
      ]);
      setSettings(s);
      setMerchants(m);
      const map: Record<string, string> = {};
      s.forEach((r) => { map[r.key] = r.value; });
      setEditing(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function saveSetting(key: string) {
    setSaving(key);
    try {
      await apiFetch("/api/admin/settings", {
        method: "POST",
        body: JSON.stringify({ key, value: editing[key] ?? "" }),
      });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(null);
    }
  }

  async function saveMerchant() {
    if (!editMerchant) return;
    setMerchantSaving(true);
    try {
      await apiFetch("/api/admin/merchants", {
        method: "PATCH",
        body: JSON.stringify(editMerchant),
      });
      await load();
      setEditMerchant(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setMerchantSaving(false);
    }
  }

  if (loading) return (
    <main className="max-w-[480px] mx-auto min-h-screen bg-pan-navy px-4 pt-6 pb-10">
      <div className="animate-pulse space-y-3">
        {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-pan-card" />)}
      </div>
    </main>
  );

  if (error) return (
    <main className="max-w-[480px] mx-auto min-h-screen bg-pan-navy px-4 pt-10 text-center">
      <p className="text-pan-pink mb-2">{error}</p>
      <button onClick={load} className="text-pan-muted text-sm underline">Retry</button>
    </main>
  );

  return (
    <main className="max-w-[480px] mx-auto min-h-screen bg-pan-navy px-4 pt-4 pb-24">
      <header className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-pan-card flex items-center justify-center text-lg font-bold text-pan-pink">⚙️</div>
        <div>
          <p className="text-white font-black">PAN Admin</p>
          <p className="text-pan-muted text-xs">Platform configuration</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex bg-pan-card rounded-xl p-1 mb-5">
        {(["settings", "merchants"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2 rounded-lg text-sm font-bold cursor-pointer transition-colors capitalize"
            style={tab === t ? { background: "#f0206a", color: "#fff" } : { color: "#6b7fb0" }}
          >
            {t === "settings" ? "⚙️ Settings" : "🏪 Merchants"}
          </button>
        ))}
      </div>

      {/* Settings tab */}
      {tab === "settings" && (
        <div className="space-y-4">
          {Object.keys(SETTING_LABELS).map((key) => (
            <div key={key} className="rounded-xl bg-pan-card border border-pan-border p-4">
              <p className="text-pan-muted text-xs uppercase tracking-widest font-bold mb-2">
                {SETTING_LABELS[key]}
              </p>
              <input
                type="text"
                value={editing[key] ?? ""}
                onChange={(e) => setEditing({ ...editing, [key]: e.target.value })}
                placeholder={`Enter ${SETTING_LABELS[key]}`}
                className="w-full bg-pan-navy border border-pan-border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-pan-pink mb-3"
              />
              <button
                onClick={() => saveSetting(key)}
                disabled={saving === key}
                className="w-full rounded-lg py-2 text-sm font-bold text-white disabled:opacity-40 cursor-pointer"
                style={{ background: "linear-gradient(135deg,#f0206a,#c01253)" }}
              >
                {saving === key ? "Saving…" : "Save"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Merchants tab */}
      {tab === "merchants" && (
        <div className="space-y-3">
          {merchants.map((m) => (
            <div key={m.merchantURL} className="rounded-xl bg-pan-card border border-pan-border p-4">
              <div className="flex justify-between items-start mb-1">
                <div>
                  <p className="text-white font-bold">{m.merchantName}</p>
                  {m.outletName && <p className="text-pan-muted text-xs">{m.outletName}</p>}
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${m.active ? "bg-green-900 text-green-400" : "bg-red-900/40 text-pan-pink"}`}>
                  {m.active ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="text-pan-muted text-xs mb-1">
                Earn: {m.earnType === "PERCENTAGE" ? `${m.earnValue}%` : `Ks ${m.earnValue}`}
                {" · "}
                Commission: {m.commissionType === "PERCENTAGE" ? `${m.commissionValue}%` : `Ks ${m.commissionValue}`}
                {" · "}
                Sub: Ks {m.subscriptionFee}
              </p>
              <p className="text-pan-muted text-xs mb-3">
                Bot: {m.botToken ? "Custom ✓" : "Default (PAN)"}{" "}
                {m.redemptionGroup ? `· Group: ${m.redemptionGroup.groupName}` : ""}
              </p>
              <button
                onClick={() => setEditMerchant({ ...m })}
                className="w-full rounded-lg py-2 text-xs font-bold text-pan-muted border border-pan-border cursor-pointer"
              >
                Edit →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Merchant edit sheet */}
      {editMerchant && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setEditMerchant(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 max-w-[480px] mx-auto rounded-t-2xl bg-pan-overlay px-5 pt-4 pb-10 shadow-2xl overflow-y-auto max-h-[85vh]">
            <div className="mx-auto mb-4 w-10 h-1 rounded-full bg-pan-border" />
            <h2 className="text-lg font-bold text-white mb-4">Edit — {editMerchant.merchantName}</h2>

            {[
              { label: "Earn Value", field: "earnValue", type: "number" },
              { label: "Commission Value", field: "commissionValue", type: "number" },
              { label: "Subscription Fee (Ks)", field: "subscriptionFee", type: "number" },
              { label: "Rebate Validity (days)", field: "rebateValidityDays", type: "number" },
              { label: "Bot Token (leave blank for PAN default)", field: "botToken", type: "text" },
            ].map(({ label, field, type }) => (
              <div key={field} className="mb-4">
                <p className="text-pan-muted text-xs uppercase tracking-widest font-bold mb-1">{label}</p>
                <input
                  type={type}
                  value={(editMerchant as Record<string, unknown>)[field] as string ?? ""}
                  onChange={(e) => setEditMerchant({ ...editMerchant, [field]: type === "number" ? Number(e.target.value) : e.target.value || null })}
                  className="w-full bg-pan-card border border-pan-border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-pan-pink"
                />
              </div>
            ))}

            <div className="mb-5">
              <p className="text-pan-muted text-xs uppercase tracking-widest font-bold mb-1">Active</p>
              <button
                onClick={() => setEditMerchant({ ...editMerchant, active: !editMerchant.active })}
                className={`px-4 py-2 rounded-lg text-sm font-bold cursor-pointer ${editMerchant.active ? "bg-green-900 text-green-400" : "bg-red-900/40 text-pan-pink"}`}
              >
                {editMerchant.active ? "Active — tap to deactivate" : "Inactive — tap to activate"}
              </button>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setEditMerchant(null)} className="flex-1 rounded-xl py-3 text-sm font-bold text-pan-muted border border-pan-border cursor-pointer">Cancel</button>
              <button
                onClick={saveMerchant}
                disabled={merchantSaving}
                className="flex-1 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-40 cursor-pointer"
                style={{ background: "linear-gradient(135deg,#f0206a,#c01253)" }}
              >
                {merchantSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
