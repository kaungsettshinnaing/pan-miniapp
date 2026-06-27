"use client";

import { useState, useRef } from "react";

type RedeemResult = {
  redeemedAmount: number;
  newCashbackAmt: number;
  purchaseAmount: number;
  merchantName: string;
  customerName: string;
  expiryDate: string;
};

type Props = {
  merchantName: string;
  apiFetch: <T>(path: string, opts?: RequestInit) => Promise<T>;
  onClose: () => void;
};

export default function MerchantProcessSheet({ merchantName, apiFetch, onClose }: Props) {
  const [pin, setPin] = useState(["", "", "", ""]);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RedeemResult | null>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  function handlePinChange(idx: number, val: string) {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...pin];
    next[idx] = digit;
    setPin(next);
    if (digit && idx < 3) inputs.current[idx + 1]?.focus();
  }

  function handlePinKey(idx: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !pin[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  }

  const otpCode = pin.join("");
  const canSubmit = otpCode.length === 4 && Number(amount) > 0 && !loading;

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<RedeemResult>("/api/redeem", {
        method: "POST",
        body: JSON.stringify({ otpCode, purchaseAmount: Number(amount) }),
      });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Redemption failed");
    } finally {
      setLoading(false);
    }
  }

  function formatKs(n: number) {
    return `Ks ${n.toLocaleString("en-US")}`;
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={result ? onClose : onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 max-w-[480px] mx-auto rounded-t-2xl bg-pan-overlay px-5 pt-4 pb-10 shadow-2xl">
        <div className="mx-auto mb-4 w-10 h-1 rounded-full bg-pan-border" />

        {!result ? (
          <>
            <h2 className="text-lg font-bold text-white mb-1">🏪 Process Redemption</h2>
            <p className="text-pan-muted text-sm mb-5">
              Enter the 4-digit PIN the customer is showing you, then the purchase amount.
            </p>

            {/* 4-digit PIN boxes */}
            <p className="text-[11px] font-bold text-pan-muted uppercase tracking-widest mb-2">
              Customer PIN
            </p>
            <div className="flex gap-3 mb-5">
              {pin.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handlePinChange(i, e.target.value)}
                  onKeyDown={(e) => handlePinKey(i, e)}
                  className="flex-1 h-14 rounded-xl bg-pan-card border border-pan-border text-center text-2xl font-black text-white outline-none focus:border-pan-pink transition-colors"
                  autoFocus={i === 0}
                />
              ))}
            </div>

            {/* Purchase amount */}
            <p className="text-[11px] font-bold text-pan-muted uppercase tracking-widest mb-2">
              Purchase Amount
            </p>
            <div className="relative mb-5">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-pan-muted text-sm font-bold">
                Ks
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl bg-pan-card border border-pan-border pl-10 pr-4 py-3 text-white text-sm outline-none focus:border-pan-pink"
              />
            </div>

            {error && <p className="text-pan-pink text-xs mb-3">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl py-3 text-sm font-bold text-pan-muted border border-pan-border cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!canSubmit}
                className="flex-1 rounded-xl py-3 text-sm font-bold text-white cursor-pointer active:opacity-80 disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #f0206a 0%, #c01253 100%)" }}
              >
                {loading ? "Processing…" : "Confirm →"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-center mb-5">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center text-3xl mx-auto mb-3">
                ✅
              </div>
              <h2 className="text-lg font-bold text-white">Redemption Complete</h2>
              <p className="text-pan-muted text-sm mt-1">
                {result.customerName} · {merchantName}
              </p>
            </div>

            {/* Summary card */}
            <div className="rounded-xl bg-pan-card border border-pan-border divide-y divide-pan-border mb-5">
              <div className="flex justify-between items-center px-4 py-3">
                <span className="text-pan-muted text-sm">Purchase Amount</span>
                <span className="text-white font-bold">{formatKs(result.purchaseAmount)}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-3">
                <span className="text-pan-muted text-sm">Cashback Redeemed</span>
                <span className="text-pan-pink font-bold">− {formatKs(result.redeemedAmount)}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-3">
                <span className="text-pan-muted text-sm">New Cashback Issued</span>
                <span className="text-pan-gold font-bold">+ {formatKs(result.newCashbackAmt)}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-3">
                <span className="text-pan-muted text-sm">Valid Until</span>
                <span className="text-white text-sm">{formatDate(result.expiryDate)}</span>
              </div>
            </div>

            <p className="text-center text-pan-muted text-xs mb-5">
              Customer will receive a Telegram notification shortly.
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
