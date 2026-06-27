"use client";

import { useState, useEffect } from "react";

type EarnResult = {
  sessionId: string;
  otpCode: string;
  merchantName: string;
  totalCashback: number;
  expiresAt: string;
};

type Props = {
  initialMerchant?: string;
  apiFetch: <T>(path: string, opts?: RequestInit) => Promise<T>;
  onClose: () => void;
  onSuccess: () => void;
};

export default function EarnSheet({ initialMerchant, apiFetch, onClose, onSuccess }: Props) {
  const [merchantCode, setMerchantCode] = useState(initialMerchant ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EarnResult | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Auto-submit if merchant pre-filled
  useEffect(() => {
    if (initialMerchant) {
      submit(initialMerchant);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // PIN countdown timer
  useEffect(() => {
    if (!result) return;
    const expiresAt = new Date(result.expiresAt).getTime();
    const tick = () => {
      const remaining = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [result]);

  async function submit(code?: string) {
    const url = (code ?? merchantCode).trim();
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<EarnResult>("/api/earn", {
        method: "POST",
        body: JSON.stringify({ merchantURL: url }),
      });
      setResult(data);
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate PIN");
    } finally {
      setLoading(false);
    }
  }

  const expired = secondsLeft === 0 && result !== null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 sheet-backdrop"
        onClick={result ? onClose : onClose}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 max-w-[480px] mx-auto rounded-t-2xl bg-pan-overlay px-5 pt-4 pb-8 shadow-2xl">
        {/* Handle */}
        <div className="mx-auto mb-4 w-10 h-1 rounded-full bg-pan-border" />

        {!result ? (
          /* Earn Cashback — enter merchant code */
          <>
            <h2 className="text-lg font-bold text-white mb-1">🏷️ Earn Cashback</h2>
            <p className="text-pan-muted text-sm mb-5">
              Enter the merchant code shown on the QR at the counter. This will
              trigger the PAN redemption flow and generate your PIN.
            </p>

            <input
              type="text"
              value={merchantCode}
              onChange={(e) => setMerchantCode(e.target.value)}
              placeholder="e.g. QQHotpotBBQ"
              className="w-full rounded-xl bg-pan-card border border-pan-border px-4 py-3 text-white placeholder:text-pan-muted text-sm outline-none focus:border-pan-pink mb-3"
              autoFocus
              autoCapitalize="none"
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />

            {error && (
              <p className="text-pan-pink text-xs mb-3">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl py-3 text-sm font-bold text-pan-muted border border-pan-border cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => submit()}
                disabled={loading || !merchantCode.trim()}
                className="flex-1 rounded-xl py-3 text-sm font-bold text-white cursor-pointer active:opacity-80 disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #f0206a 0%, #c01253 100%)" }}
              >
                {loading ? "Loading…" : "Get My PIN →"}
              </button>
            </div>
          </>
        ) : (
          /* Show PIN to Cashier */
          <>
            <h2 className="text-lg font-bold text-white mb-1">🔢 Show PIN to Cashier</h2>
            <p className="text-pan-muted text-sm mb-4">
              Show the PIN below to the cashier. They will enter it in their app
              to confirm your cashback redemption.
            </p>

            {/* Merchant + amount summary */}
            <div className="flex justify-between items-center bg-pan-card rounded-xl px-4 py-3 mb-4">
              <span className="text-white font-bold text-sm">{result.merchantName}</span>
              <span className="text-pan-gold font-black font-latin">
                Ks {result.totalCashback.toLocaleString("en-US")}
              </span>
            </div>

            {/* PIN box */}
            <div
              className="rounded-xl px-4 py-5 mb-3 text-center"
              style={{
                border: "2px dashed rgba(240,32,106,0.6)",
                background: "rgba(240,32,106,0.05)",
              }}
            >
              <p className="text-[11px] font-bold text-pan-pink uppercase tracking-widest mb-2">
                Your Redemption PIN
              </p>
              <p
                className="font-black font-latin text-5xl tracking-[0.3em] text-white pin-pop"
                style={{ textShadow: "0 2px 0 rgba(0,0,0,0.3)" }}
              >
                {result.otpCode}
              </p>
              {!expired && (
                <p className="text-pan-muted text-xs mt-3">
                  ✨ Valid for this visit only — expires in {Math.floor(secondsLeft / 60)}:
                  {String(secondsLeft % 60).padStart(2, "0")}
                </p>
              )}
              {expired && (
                <p className="text-pan-pink text-xs mt-3">⚠️ PIN expired — tap Done and try again</p>
              )}
            </div>

            <p className="text-center text-pan-muted text-xs mb-4">
              ✨ Valid for this visit only — do not share
            </p>

            <button
              onClick={onClose}
              className="w-full rounded-xl py-3 text-sm font-bold text-white bg-pan-card border border-pan-border cursor-pointer"
            >
              Done
            </button>
          </>
        )}
      </div>
    </>
  );
}
