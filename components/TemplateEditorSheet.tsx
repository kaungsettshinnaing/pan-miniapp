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
  CASHBACK_ISSUED_WITH_REDEMPTION: "✅ Cashback Issued (after redemption)",
  REDEMPTION_FAILURE: "❌ Redemption Failure",
  EXPIRY_FIRST_REMINDER: "⏰ Expiry Reminder #1",
  EXPIRY_SECOND_REMINDER: "⏰ Expiry Reminder #2",
  FIRST_RECALL_CAMPAIGN: "📣 Win-back Campaign #1",
  SECOND_RECALL_CAMPAIGN: "📣 Win-back Campaign #2",
};

// {{pin}} only renders for the "Cashback Issued" message (the earn/PIN message);
// the others render wherever their data is available for that trigger.
const VARIABLES = ["{{pin}}", "{{cashbackAmt}}", "{{expiryDate}}", "{{merchantName}}", "{{purchaseAmount}}", "{{customerName}}", "{{reminderDays}}"];

type Props = {
  apiFetch: <T>(path: string, opts?: RequestInit) => Promise<T>;
  onClose: () => void;
  adminMerchantURL?: string; // when set, uses admin endpoint for this specific merchant
};

export default function TemplateEditorSheet({ apiFetch, onClose, adminMerchantURL }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState({ messageText: "", imageURL: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const getUrl = adminMerchantURL
    ? `/api/admin/templates?merchantURL=${encodeURIComponent(adminMerchantURL)}`
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
      const putUrl = adminMerchantURL ? "/api/admin/templates" : "/api/merchant/templates";
      const putBody = adminMerchantURL
        ? { merchantURL: adminMerchantURL, trigger: selected, messageText: form.messageText || null, imageURL: form.imageURL || null }
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
                {[1,2,3].map(i => <div key={i} className="h-12 rounded-xl bg-pan-card animate-pulse" />)}
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
            <button onClick={onClose} className="w-full rounded-xl py-3 text-sm font-bold text-pan-muted border border-pan-border mt-4 cursor-pointer">
              Close
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setSelected(null)} className="text-pan-pink text-sm mb-3 cursor-pointer">
              ← Back
            </button>
            <h2 className="text-base font-bold text-white mb-4">{TRIGGER_LABELS[selected]}</h2>

            {/* Image URL */}
            <p className="text-pan-muted text-xs uppercase tracking-widest font-bold mb-1">Image URL (optional)</p>
            <input
              type="text"
              value={form.imageURL}
              onChange={(e) => setForm({ ...form, imageURL: e.target.value })}
              placeholder="https://..."
              className="w-full bg-pan-card border border-pan-border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-pan-pink mb-4"
            />

            {/* Message text */}
            <p className="text-pan-muted text-xs uppercase tracking-widest font-bold mb-1">Message Text</p>
            <textarea
              value={form.messageText}
              onChange={(e) => setForm({ ...form, messageText: e.target.value })}
              placeholder="Your cashback of {{cashbackAmt}} is ready! Valid until {{expiryDate}}."
              rows={5}
              className="w-full bg-pan-card border border-pan-border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-pan-pink mb-3 resize-none"
            />

            {/* Variable chips */}
            <p className="text-pan-muted text-xs mb-2">Tap to insert variable:</p>
            <div className="flex flex-wrap gap-2 mb-5">
              {VARIABLES.map((v) => (
                <button
                  key={v}
                  onClick={() => insertVar(v)}
                  className="px-3 py-1 rounded-full bg-pan-card border border-pan-border text-pan-gold text-xs font-bold cursor-pointer"
                >
                  {v}
                </button>
              ))}
            </div>

            {saved && <p className="text-green-400 text-xs text-center mb-3">✓ Saved</p>}

            <div className="flex gap-3">
              <button onClick={() => setSelected(null)} className="flex-1 rounded-xl py-3 text-sm font-bold text-pan-muted border border-pan-border cursor-pointer">
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
