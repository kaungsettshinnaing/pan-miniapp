"use client";

import { useState, useEffect } from "react";

type Template = {
  id: string;
  trigger: string;
  messageText: string | null;
  imageURL: string | null;
};

const TRIGGER_LABELS: Record<string, string> = {
  CASHBACK_ISSUED: "💰 Cashback Issued",
  CASHBACK_ISSUED_WITH_REDEMPTION: "✅ Cashback Issued (returning customer)",
  CASHBACK_ISSUED_NO_PRIOR_BALANCE: "🆕 Cashback Earned (first visit / no prior balance)",
  REDEMPTION_FAILURE: "❌ Redemption Failure",
  REDEMPTION_CANCELLED: "🚫 Redemption Cancelled",
  EXPIRY_FIRST_REMINDER: "⏰ Expiry Reminder #1",
  EXPIRY_SECOND_REMINDER: "⏰ Expiry Reminder #2",
  FIRST_RECALL_CAMPAIGN: "📣 Win-back Campaign #1",
  SECOND_RECALL_CAMPAIGN: "📣 Win-back Campaign #2",
};

type VarDef = { variable: string; label: string };

// Per-trigger variable definitions — only show what's actually available for each trigger.
// {{redeemedAmt}} = cashback balance used/redeemed; {{cashbackAmt}} = newly issued cashback.
const TRIGGER_VARS: Record<string, VarDef[]> = {
  CASHBACK_ISSUED: [
    { variable: "{{merchantName}}", label: "Merchant name" },
    { variable: "{{cashbackAmt}}", label: "Cashback balance" },
    { variable: "{{expiryDate}}", label: "Expiry date" },
    { variable: "{{pin}}", label: "Redemption PIN" },
    { variable: "{{customerName}}", label: "Customer name" },
  ],
  CASHBACK_ISSUED_WITH_REDEMPTION: [
    { variable: "{{merchantName}}", label: "Merchant name" },
    { variable: "{{redeemedAmt}}", label: "Cashback redeemed (used)" },
    { variable: "{{cashbackAmt}}", label: "New cashback earned" },
    { variable: "{{purchaseAmount}}", label: "Purchase amount" },
    { variable: "{{expiryDate}}", label: "New cashback expiry" },
    { variable: "{{customerName}}", label: "Customer name" },
  ],
  CASHBACK_ISSUED_NO_PRIOR_BALANCE: [
    { variable: "{{merchantName}}", label: "Merchant name" },
    { variable: "{{cashbackAmt}}", label: "Cashback earned" },
    { variable: "{{purchaseAmount}}", label: "Purchase amount" },
    { variable: "{{expiryDate}}", label: "Cashback expiry" },
    { variable: "{{customerName}}", label: "Customer name" },
  ],
  REDEMPTION_FAILURE: [
    { variable: "{{merchantName}}", label: "Merchant name" },
    { variable: "{{customerName}}", label: "Customer name" },
  ],
  REDEMPTION_CANCELLED: [
    { variable: "{{merchantName}}", label: "Merchant name" },
    { variable: "{{customerName}}", label: "Customer name" },
  ],
  EXPIRY_FIRST_REMINDER: [
    { variable: "{{merchantName}}", label: "Merchant name" },
    { variable: "{{cashbackAmt}}", label: "Cashback balance" },
    { variable: "{{expiryDate}}", label: "Expiry date" },
    { variable: "{{reminderDays}}", label: "Days until expiry" },
    { variable: "{{customerName}}", label: "Customer name" },
  ],
  EXPIRY_SECOND_REMINDER: [
    { variable: "{{merchantName}}", label: "Merchant name" },
    { variable: "{{cashbackAmt}}", label: "Cashback balance" },
    { variable: "{{expiryDate}}", label: "Expiry date" },
    { variable: "{{reminderDays}}", label: "Days until expiry" },
    { variable: "{{customerName}}", label: "Customer name" },
  ],
  FIRST_RECALL_CAMPAIGN: [
    { variable: "{{merchantName}}", label: "Merchant name" },
    { variable: "{{customerName}}", label: "Customer name" },
  ],
  SECOND_RECALL_CAMPAIGN: [
    { variable: "{{merchantName}}", label: "Merchant name" },
    { variable: "{{customerName}}", label: "Customer name" },
  ],
};

type Props = {
  apiFetch: <T>(path: string, opts?: RequestInit) => Promise<T>;
  onClose: () => void;
  adminMerchantURL?: string;
  cpMerchantURL?: string;
};

export default function TemplateEditorSheet({ apiFetch, onClose, adminMerchantURL, cpMerchantURL }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState({ messageText: "", imageURL: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const getUrl = adminMerchantURL
    ? `/api/admin/templates?merchantURL=${encodeURIComponent(adminMerchantURL)}`
    : cpMerchantURL
    ? `/api/cp/templates?merchantURL=${encodeURIComponent(cpMerchantURL)}`
    : "/api/merchant/templates";

  useEffect(() => { loadTemplates(); }, []);

  async function loadTemplates() {
    setLoading(true);
    try {
      const data = await apiFetch<Template[]>(getUrl);
      setTemplates(data);
    } finally {
      setLoading(false);
    }
  }

  function selectTrigger(trigger: string) {
    const existing = templates.find((t) => t.trigger === trigger);
    setForm({
      messageText: existing?.messageText ?? "",
      imageURL: existing?.imageURL ?? "",
    });
    setSelected(trigger);
    setSaved(false);
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    try {
      const putUrl = adminMerchantURL
        ? "/api/admin/templates"
        : cpMerchantURL
        ? "/api/cp/templates"
        : "/api/merchant/templates";
      const putBody = adminMerchantURL
        ? { merchantURL: adminMerchantURL, trigger: selected, messageText: form.messageText || null, imageURL: form.imageURL || null }
        : cpMerchantURL
        ? { merchantURL: cpMerchantURL, trigger: selected, messageText: form.messageText || null, imageURL: form.imageURL || null }
        : { trigger: selected, messageText: form.messageText || null, imageURL: form.imageURL || null };
      await apiFetch(putUrl, { method: "PUT", body: JSON.stringify(putBody) });
      await loadTemplates();
      setSaved(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function insertVar(v: string) {
    setForm((f) => ({ ...f, messageText: f.messageText + v }));
  }

  const currentVars = selected ? (TRIGGER_VARS[selected] ?? []) : [];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 max-w-[480px] mx-auto rounded-t-2xl bg-pan-overlay px-5 pt-4 pb-10 shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="mx-auto mb-4 w-10 h-1 rounded-full bg-pan-border" />

        {!selected ? (
          <>
            <h2 className="text-lg font-bold text-white mb-1">✉️ Message Templates</h2>
            <p className="text-pan-muted text-sm mb-4">
              Customize the Telegram message sent to customers for each event.
            </p>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 rounded-xl bg-pan-card animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(TRIGGER_LABELS).map(([trigger, label]) => {
                  const has = templates.some((t) => t.trigger === trigger && (t.messageText || t.imageURL));
                  return (
                    <button
                      key={trigger}
                      onClick={() => selectTrigger(trigger)}
                      className="w-full flex justify-between items-center rounded-xl bg-pan-card border border-pan-border px-4 py-3 cursor-pointer text-left"
                    >
                      <span className="text-white text-sm font-bold">{label}</span>
                      <span className={`text-xs font-bold ${has ? "text-green-400" : "text-pan-muted"}`}>
                        {has ? "Custom ✓" : "Default"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <button
              onClick={onClose}
              className="w-full rounded-xl py-3 text-sm font-bold text-pan-muted border border-pan-border mt-4 cursor-pointer"
            >
              Close
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setSelected(null)} className="text-pan-pink text-sm mb-3 cursor-pointer">
              ← Back
            </button>
            <h2 className="text-base font-bold text-white mb-4">{TRIGGER_LABELS[selected]}</h2>

            <p className="text-pan-muted text-xs uppercase tracking-widest font-bold mb-1">
              Image URL (optional)
            </p>
            <input
              type="text"
              value={form.imageURL}
              onChange={(e) => setForm({ ...form, imageURL: e.target.value })}
              placeholder="https://..."
              className="w-full bg-pan-card border border-pan-border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-pan-pink mb-4"
            />

            <p className="text-pan-muted text-xs uppercase tracking-widest font-bold mb-1">
              Message Text
            </p>
            <textarea
              value={form.messageText}
              onChange={(e) => setForm({ ...form, messageText: e.target.value })}
              placeholder="Leave blank to use the default message."
              rows={5}
              className="w-full bg-pan-card border border-pan-border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-pan-pink mb-3 resize-none"
            />

            {/* Per-trigger variable chips with labels */}
            <p className="text-pan-muted text-xs mb-2">Tap to insert variable:</p>
            <div className="flex flex-col gap-2 mb-5">
              {currentVars.map(({ variable, label }) => (
                <button
                  key={variable}
                  onClick={() => insertVar(variable)}
                  className="flex items-center gap-3 rounded-xl bg-pan-card border border-pan-border px-3 py-2.5 cursor-pointer text-left"
                >
                  <span className="text-pan-gold text-xs font-black font-latin shrink-0">{variable}</span>
                  <span className="text-pan-muted text-xs">{label}</span>
                </button>
              ))}
            </div>

            {saved && <p className="text-green-400 text-xs text-center mb-3">✓ Saved</p>}

            <div className="flex gap-3">
              <button
                onClick={() => setSelected(null)}
                className="flex-1 rounded-xl py-3 text-sm font-bold text-pan-muted border border-pan-border cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-40 cursor-pointer"
                style={{ background: "linear-gradient(135deg,#f0206a,#c01253)" }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
