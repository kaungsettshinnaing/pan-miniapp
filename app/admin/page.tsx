"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/app/page";
import TemplateEditorSheet from "@/components/TemplateEditorSheet";

type Setting = { key: string; value: string };

type RedemptionGroup = { id: string; groupName: string };

type WebUser = {
  id: string;
  username: string;
  role: "ADMIN" | "MERCHANT" | "CHANNEL_PARTNER";
  merchantURL: string | null;
  redemptionGroupID: string | null;
  profitSharePct: number | null;
  createdAt: string;
};

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
  commissionBasis: string;
  commissionValue: number;
  subscriptionFee: number;
  rebateValidityDays: number;
  firstReminderDays: number;
  secondReminderDays: number;
  firstRecallCampaignDays: number;
  secondRecallCampaignDays: number;
  redemptionGroupID: string | null;
  redemptionGroup: { groupName: string } | null;
};

const SETTING_LABELS: Record<string, string> = {
  N8N_WEBHOOK_URL: "n8n Webhook Base URL",
  DEFAULT_BOT_TOKEN: "Default Telegram Bot Token",
  CASHBACK_APP_NAME: "App Name",
};

function ToggleGroup({ label, options, value, onChange }: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mb-4">
      <p className="text-pan-muted text-xs uppercase tracking-widest font-bold mb-1">{label}</p>
      <div className="flex gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className="flex-1 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors"
            style={value === o.value ? { background: "#f0206a", color: "#fff" } : { background: "#1e2d5a", color: "#6b7fb0" }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"settings" | "merchants" | "users">("settings");
  const [settings, setSettings] = useState<Setting[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [webUsers, setWebUsers] = useState<WebUser[]>([]);
  const [redemptionGroups, setRedemptionGroups] = useState<RedemptionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [editMerchant, setEditMerchant] = useState<Merchant | null>(null);
  const [merchantSaving, setMerchantSaving] = useState(false);
  const [templatesMerchantURL, setTemplatesMerchantURL] = useState<string | null>(null);
  const [newUser, setNewUser] = useState<{ username: string; password: string; role: "ADMIN" | "MERCHANT" | "CHANNEL_PARTNER"; merchantURL: string; redemptionGroupID: string; profitSharePct: string } | null>(null);
  const [newUserSaving, setNewUserSaving] = useState(false);
  const [resetUser, setResetUser] = useState<{ id: string; username: string; role: string; password: string; profitSharePct: string } | null>(null);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [s, m, u, g] = await Promise.all([
        apiFetch<Setting[]>("/api/admin/settings"),
        apiFetch<Merchant[]>("/api/admin/merchants"),
        apiFetch<WebUser[]>("/api/admin/web-users"),
        apiFetch<RedemptionGroup[]>("/api/admin/groups"),
      ]);
      setSettings(s);
      setMerchants(m);
      setWebUsers(u);
      setRedemptionGroups(g);
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

  async function createUser() {
    if (!newUser) return;
    setNewUserSaving(true);
    try {
      await apiFetch("/api/admin/web-users", {
        method: "POST",
        body: JSON.stringify({
          username: newUser.username,
          password: newUser.password,
          role: newUser.role,
          merchantURL: newUser.role === "MERCHANT" && !newUser.redemptionGroupID ? newUser.merchantURL || null : null,
          redemptionGroupID: newUser.role === "MERCHANT" && newUser.redemptionGroupID ? newUser.redemptionGroupID : null,
          profitSharePct: newUser.role === "CHANNEL_PARTNER" && newUser.profitSharePct ? Number(newUser.profitSharePct) : null,
        }),
      });
      setNewUser(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setNewUserSaving(false);
    }
  }

  async function resetPassword() {
    if (!resetUser) return;
    setNewUserSaving(true);
    try {
      await apiFetch("/api/admin/web-users", {
        method: "PATCH",
        body: JSON.stringify({
          id: resetUser.id,
          ...(resetUser.password ? { password: resetUser.password } : {}),
          ...(resetUser.role === "CHANNEL_PARTNER" ? { profitSharePct: resetUser.profitSharePct ? Number(resetUser.profitSharePct) : null } : {}),
        }),
      });
      setResetUser(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setNewUserSaving(false);
    }
  }

  async function deleteUser(id: string, username: string) {
    if (!confirm(`Delete user "${username}"?`)) return;
    try {
      await apiFetch(`/api/admin/web-users?id=${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    }
  }

  async function saveMerchant() {
    if (!editMerchant) return;
    setMerchantSaving(true);
    try {
      // Send only scalar fields (no relation objects)
      await apiFetch("/api/admin/merchants", {
        method: "PATCH",
        body: JSON.stringify({
          merchantURL: editMerchant.merchantURL,
          merchantName: editMerchant.merchantName,
          outletName: editMerchant.outletName,
          merchantTelegramID: editMerchant.merchantTelegramID,
          active: editMerchant.active,
          botToken: editMerchant.botToken,
          earnType: editMerchant.earnType,
          earnValue: editMerchant.earnValue,
          commissionType: editMerchant.commissionType,
          commissionBasis: editMerchant.commissionBasis,
          commissionValue: editMerchant.commissionValue,
          subscriptionFee: editMerchant.subscriptionFee,
          rebateValidityDays: editMerchant.rebateValidityDays,
          firstReminderDays: editMerchant.firstReminderDays,
          secondReminderDays: editMerchant.secondReminderDays,
          firstRecallCampaignDays: editMerchant.firstRecallCampaignDays,
          secondRecallCampaignDays: editMerchant.secondRecallCampaignDays,
          redemptionGroupID: editMerchant.redemptionGroupID,
        }),
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
      {error.includes("Unauthorized") || error.includes("Forbidden") ? (
        <button onClick={() => router.push("/login")} className="text-pan-pink text-sm font-bold underline">Sign In →</button>
      ) : (
        <button onClick={load} className="text-pan-muted text-sm underline">Retry</button>
      )}
    </main>
  );

  return (
    <main className="max-w-[480px] mx-auto min-h-screen bg-pan-navy px-4 pt-4 pb-24">
      <header className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-pan-card flex items-center justify-center text-lg font-bold text-pan-pink">⚙️</div>
        <div className="flex-1">
          <p className="text-white font-black">PAN Admin</p>
          <p className="text-pan-muted text-xs">Platform configuration</p>
        </div>
        <button onClick={logout} className="text-pan-muted text-xs border border-pan-border rounded-lg px-3 py-1.5 cursor-pointer">
          Sign out
        </button>
      </header>

      {/* Tabs */}
      <div className="flex bg-pan-card rounded-xl p-1 mb-5">
        {(["settings", "merchants", "users"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2 rounded-lg text-sm font-bold cursor-pointer transition-colors capitalize"
            style={tab === t ? { background: "#f0206a", color: "#fff" } : { color: "#6b7fb0" }}
          >
            {t === "settings" ? "⚙️ Settings" : t === "merchants" ? "🏪 Merchants" : "👥 Users"}
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
                Earn: {m.earnType === "PERCENTAGE" ? `${m.earnValue}%` : `Ks ${m.earnValue} (fixed)`}
                {" · "}
                Commission: {m.commissionType === "FLAT" ? `Ks ${m.commissionValue} flat` : `${m.commissionValue}% (${m.commissionBasis === "RETURN_TRANSACTION" ? "return" : "initial"})`}
              </p>
              <p className="text-pan-muted text-xs mb-3">
                Sub: Ks {m.subscriptionFee}
                {m.redemptionGroup ? ` · Group: ${m.redemptionGroup.groupName}` : ""}
                {m.botToken ? " · Custom bot" : ""}
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

      {/* Users tab */}
      {tab === "users" && (
        <div className="space-y-3">
          <button
            onClick={() => setNewUser({ username: "", password: "", role: "MERCHANT", merchantURL: "", redemptionGroupID: "", profitSharePct: "" })}
            className="w-full rounded-xl py-3 text-sm font-bold text-white cursor-pointer"
            style={{ background: "linear-gradient(135deg,#f0206a,#c01253)" }}
          >
            + Create Login
          </button>
          {webUsers.map((u) => (
            <div key={u.id} className="rounded-xl bg-pan-card border border-pan-border p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-pan-navy flex items-center justify-center text-sm font-bold text-pan-pink">
                {u.username[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm">{u.username}</p>
                <p className="text-pan-muted text-xs">
                  {u.role}
                  {u.merchantURL ? ` · ${u.merchantURL}` : ""}
                  {u.redemptionGroupID ? ` · group` : ""}
                  {u.profitSharePct != null ? ` · ${u.profitSharePct}% share` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setResetUser({ id: u.id, username: u.username, role: u.role, password: "", profitSharePct: String(u.profitSharePct ?? "") })}
                  className="text-pan-muted text-xs border border-pan-border rounded-lg px-2 py-1 cursor-pointer"
                >
                  Reset
                </button>
                <button
                  onClick={() => deleteUser(u.id, u.username)}
                  className="text-pan-pink text-xs border border-pan-pink/30 rounded-lg px-2 py-1 cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {webUsers.length === 0 && (
            <p className="text-center text-pan-muted text-sm py-6">No web logins yet.</p>
          )}
        </div>
      )}

      {/* Create user sheet */}
      {newUser && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setNewUser(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 max-w-[480px] mx-auto rounded-t-2xl bg-pan-overlay px-5 pt-4 pb-10 shadow-2xl">
            <div className="mx-auto mb-4 w-10 h-1 rounded-full bg-pan-border" />
            <h2 className="text-lg font-bold text-white mb-4">Create Login</h2>
            {[
              { label: "Username", field: "username", type: "text" },
              { label: "Password", field: "password", type: "password" },
            ].map(({ label, field, type }) => (
              <div key={field} className="mb-4">
                <p className="text-pan-muted text-xs uppercase tracking-widest font-bold mb-1">{label}</p>
                <input
                  type={type}
                  value={(newUser as Record<string, string>)[field]}
                  onChange={(e) => setNewUser({ ...newUser, [field]: e.target.value })}
                  autoCapitalize="none"
                  className="w-full bg-pan-card border border-pan-border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-pan-pink"
                />
              </div>
            ))}
            <div className="mb-4">
              <p className="text-pan-muted text-xs uppercase tracking-widest font-bold mb-1">Role</p>
              <div className="flex gap-2 flex-wrap">
                {(["ADMIN", "MERCHANT", "CHANNEL_PARTNER"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setNewUser({ ...newUser, role: r })}
                    className="flex-1 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
                    style={newUser.role === r ? { background: "#f0206a", color: "#fff" } : { background: "#1e2d5a", color: "#6b7fb0" }}
                  >
                    {r === "CHANNEL_PARTNER" ? "Channel Partner" : r}
                  </button>
                ))}
              </div>
            </div>

            {newUser.role === "MERCHANT" && (
              <>
                <div className="mb-3">
                  <p className="text-pan-muted text-xs uppercase tracking-widest font-bold mb-1">Single Outlet</p>
                  <select
                    value={newUser.merchantURL}
                    onChange={(e) => setNewUser({ ...newUser, merchantURL: e.target.value, redemptionGroupID: "" })}
                    className="w-full bg-pan-card border border-pan-border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-pan-pink"
                  >
                    <option value="">— select merchant —</option>
                    {merchants.map((m) => (
                      <option key={m.merchantURL} value={m.merchantURL}>{m.merchantName} ({m.merchantURL})</option>
                    ))}
                  </select>
                </div>
                <div className="mb-4">
                  <p className="text-pan-muted text-xs uppercase tracking-widest font-bold mb-1">OR Redemption Group (group owner)</p>
                  <select
                    value={newUser.redemptionGroupID}
                    onChange={(e) => setNewUser({ ...newUser, redemptionGroupID: e.target.value, merchantURL: "" })}
                    className="w-full bg-pan-card border border-pan-border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-pan-pink"
                  >
                    <option value="">— select group —</option>
                    {redemptionGroups.map((g) => (
                      <option key={g.id} value={g.id}>{g.groupName}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {newUser.role === "CHANNEL_PARTNER" && (
              <div className="mb-4">
                <p className="text-pan-muted text-xs uppercase tracking-widest font-bold mb-1">Profit Share %</p>
                <input
                  type="number"
                  min="0" max="100" step="0.1"
                  value={newUser.profitSharePct}
                  onChange={(e) => setNewUser({ ...newUser, profitSharePct: e.target.value })}
                  placeholder="e.g. 20 for 20%"
                  className="w-full bg-pan-card border border-pan-border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-pan-pink"
                />
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setNewUser(null)} className="flex-1 rounded-xl py-3 text-sm font-bold text-pan-muted border border-pan-border cursor-pointer">Cancel</button>
              <button
                onClick={createUser}
                disabled={newUserSaving || !newUser.username || !newUser.password}
                className="flex-1 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-40 cursor-pointer"
                style={{ background: "linear-gradient(135deg,#f0206a,#c01253)" }}
              >
                {newUserSaving ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Reset password sheet */}
      {resetUser && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setResetUser(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 max-w-[480px] mx-auto rounded-t-2xl bg-pan-overlay px-5 pt-4 pb-10 shadow-2xl">
            <div className="mx-auto mb-4 w-10 h-1 rounded-full bg-pan-border" />
            <h2 className="text-lg font-bold text-white mb-1">Reset Password</h2>
            <p className="text-pan-muted text-sm mb-4">{resetUser.username} · {resetUser.role}</p>
            <p className="text-pan-muted text-xs uppercase tracking-widest font-bold mb-1">New Password (leave blank to keep)</p>
            <input
              type="password"
              value={resetUser.password}
              onChange={(e) => setResetUser({ ...resetUser, password: e.target.value })}
              placeholder="Enter new password"
              className="w-full bg-pan-card border border-pan-border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-pan-pink mb-4"
            />
            {resetUser.role === "CHANNEL_PARTNER" && (
              <div className="mb-4">
                <p className="text-pan-muted text-xs uppercase tracking-widest font-bold mb-1">Profit Share %</p>
                <input
                  type="number" min="0" max="100" step="0.1"
                  value={resetUser.profitSharePct}
                  onChange={(e) => setResetUser({ ...resetUser, profitSharePct: e.target.value })}
                  placeholder="e.g. 20"
                  className="w-full bg-pan-card border border-pan-border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-pan-pink"
                />
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setResetUser(null)} className="flex-1 rounded-xl py-3 text-sm font-bold text-pan-muted border border-pan-border cursor-pointer">Cancel</button>
              <button
                onClick={resetPassword}
                disabled={newUserSaving}
                className="flex-1 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-40 cursor-pointer"
                style={{ background: "linear-gradient(135deg,#f0206a,#c01253)" }}
              >
                {newUserSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Merchant edit sheet */}
      {editMerchant && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setEditMerchant(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 max-w-[480px] mx-auto rounded-t-2xl bg-pan-overlay px-5 pt-4 pb-10 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="mx-auto mb-4 w-10 h-1 rounded-full bg-pan-border" />
            <h2 className="text-lg font-bold text-white mb-1">Edit Merchant</h2>
            <p className="text-pan-muted text-xs mb-5">{editMerchant.merchantURL}</p>

            {/* ── Section A: Merchant Setup ── */}
            <p className="text-pan-gold text-xs font-bold uppercase tracking-widest mb-3">Merchant Setup</p>

            {/* Merchant Telegram ID */}
            <div className="mb-4">
              <p className="text-pan-muted text-xs uppercase tracking-widest font-bold mb-1">Merchant Telegram ID</p>
              <input
                type="text"
                value={editMerchant.merchantTelegramID}
                onChange={(e) => setEditMerchant({ ...editMerchant, merchantTelegramID: e.target.value })}
                placeholder="Telegram user ID of cashier/owner"
                className="w-full bg-pan-card border border-pan-border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-pan-pink"
              />
            </div>

            {/* Earn type + value */}
            <ToggleGroup
              label="Earn Type"
              options={[{ value: "PERCENTAGE", label: "%" }, { value: "FIXED", label: "Fixed Ks" }]}
              value={editMerchant.earnType}
              onChange={(v) => setEditMerchant({ ...editMerchant, earnType: v })}
            />
            <div className="mb-4">
              <p className="text-pan-muted text-xs uppercase tracking-widest font-bold mb-1">
                Earn Value {editMerchant.earnType === "PERCENTAGE" ? "(% of net purchase)" : "(fixed Ks per transaction)"}
              </p>
              <input
                type="number" min="0" step="0.1"
                value={editMerchant.earnValue}
                onChange={(e) => setEditMerchant({ ...editMerchant, earnValue: Number(e.target.value) })}
                className="w-full bg-pan-card border border-pan-border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-pan-pink"
              />
            </div>

            {/* Commission type + basis + value */}
            <ToggleGroup
              label="Commission Type"
              options={[{ value: "PERCENTAGE", label: "%" }, { value: "FLAT", label: "Flat Ks" }]}
              value={editMerchant.commissionType}
              onChange={(v) => setEditMerchant({ ...editMerchant, commissionType: v })}
            />
            {editMerchant.commissionType === "PERCENTAGE" && (
              <ToggleGroup
                label="Commission Basis"
                options={[
                  { value: "RETURN_TRANSACTION", label: "Return Visit" },
                  { value: "INITIAL_TRANSACTION", label: "Original Visit" },
                ]}
                value={editMerchant.commissionBasis}
                onChange={(v) => setEditMerchant({ ...editMerchant, commissionBasis: v })}
              />
            )}
            <div className="mb-4">
              <p className="text-pan-muted text-xs uppercase tracking-widest font-bold mb-1">
                {editMerchant.commissionType === "FLAT" ? "Commission (flat Ks)" : "Commission (% of gross purchase)"}
              </p>
              <input
                type="number" min="0" step="0.1"
                value={editMerchant.commissionValue}
                onChange={(e) => setEditMerchant({ ...editMerchant, commissionValue: Number(e.target.value) })}
                className="w-full bg-pan-card border border-pan-border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-pan-pink"
              />
            </div>

            {/* Other setup fields */}
            {([
              { label: "Subscription Fee (Ks/month)", field: "subscriptionFee" },
              { label: "Cashback Validity (days)", field: "rebateValidityDays" },
            ] as const).map(({ label, field }) => (
              <div key={field} className="mb-4">
                <p className="text-pan-muted text-xs uppercase tracking-widest font-bold mb-1">{label}</p>
                <input
                  type="number" min="0"
                  value={editMerchant[field] as number}
                  onChange={(e) => setEditMerchant({ ...editMerchant, [field]: Number(e.target.value) })}
                  className="w-full bg-pan-card border border-pan-border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-pan-pink"
                />
              </div>
            ))}

            <div className="mb-4">
              <p className="text-pan-muted text-xs uppercase tracking-widest font-bold mb-1">Bot Token (blank = PAN default)</p>
              <input
                type="text"
                value={editMerchant.botToken ?? ""}
                onChange={(e) => setEditMerchant({ ...editMerchant, botToken: e.target.value || null })}
                placeholder="Leave blank to use PAN shared bot"
                className="w-full bg-pan-card border border-pan-border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-pan-pink"
              />
            </div>

            <div className="mb-4">
              <p className="text-pan-muted text-xs uppercase tracking-widest font-bold mb-1">Redemption Group</p>
              <select
                value={editMerchant.redemptionGroupID ?? ""}
                onChange={(e) => setEditMerchant({ ...editMerchant, redemptionGroupID: e.target.value || null })}
                className="w-full bg-pan-card border border-pan-border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-pan-pink"
              >
                <option value="">— none (standalone) —</option>
                {redemptionGroups.map((g) => (
                  <option key={g.id} value={g.id}>{g.groupName}</option>
                ))}
              </select>
            </div>

            <div className="mb-6">
              <p className="text-pan-muted text-xs uppercase tracking-widest font-bold mb-2">Status</p>
              <button
                onClick={() => setEditMerchant({ ...editMerchant, active: !editMerchant.active })}
                className={`px-4 py-2 rounded-lg text-sm font-bold cursor-pointer ${editMerchant.active ? "bg-green-900 text-green-400" : "bg-red-900/40 text-pan-pink"}`}
              >
                {editMerchant.active ? "Active — tap to deactivate" : "Inactive — tap to activate"}
              </button>
            </div>

            {/* ── Section B: Communication Setup ── */}
            <div className="border-t border-pan-border pt-5 mb-5">
              <p className="text-pan-gold text-xs font-bold uppercase tracking-widest mb-3">Communication Setup</p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                {([
                  { label: "Reminder 1 (days before)", field: "firstReminderDays" },
                  { label: "Reminder 2 (days before)", field: "secondReminderDays" },
                  { label: "Win-back 1 (days since visit)", field: "firstRecallCampaignDays" },
                  { label: "Win-back 2 (days since visit)", field: "secondRecallCampaignDays" },
                ] as const).map(({ label, field }) => (
                  <div key={field}>
                    <p className="text-pan-muted text-xs font-bold mb-1">{label}</p>
                    <input
                      type="number" min="0"
                      value={editMerchant[field] as number}
                      onChange={(e) => setEditMerchant({ ...editMerchant, [field]: Number(e.target.value) })}
                      className="w-full bg-pan-card border border-pan-border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-pan-pink"
                    />
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  setEditMerchant(null);
                  setTemplatesMerchantURL(editMerchant.merchantURL);
                }}
                className="w-full rounded-xl py-3 text-sm font-bold text-pan-muted border border-pan-border cursor-pointer"
              >
                ✉️ Edit Message Templates →
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

      {/* Template editor — admin context for a specific merchant */}
      {templatesMerchantURL && (
        <TemplateEditorSheet
          apiFetch={apiFetch}
          adminMerchantURL={templatesMerchantURL}
          onClose={() => setTemplatesMerchantURL(null)}
        />
      )}
    </main>
  );
}
