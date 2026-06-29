"use client";

import { useState, useEffect } from "react";
import { translations, type Lang } from "@/lib/i18n";

type EarnResult = {
  sessionId: string;
  otpCode: string;
  merchantName: string;
  totalCashback: number;
  expiresAt: string;
};

export type PreloadedSession = {
  sessionId: string;
  otpCode: string;
  merchantName: string;
  merchantURL: string;
  totalCashback: number;
  expiresAt: string;
};

type ResolvedMsg = { trigger: string; text: string; imageURL: string | null };

type StatusResult = {
  status: "pending" | "redeemed" | "expired" | "cancelled";
  customerMessage?: ResolvedMsg;
  merchantName?: string;
};

type ViewState = "input" | "otp" | "success" | "failed";

type Props = {
  initialMerchant?: string;
  preloadedSession?: PreloadedSession;
  lang: Lang;
  apiFetch: <T>(path: string, opts?: RequestInit) => Promise<T>;
  onClose: () => void;
  onSuccess: () => void;
};

export default function EarnSheet({ initialMerchant, preloadedSession, lang, apiFetch, onClose, onSuccess }: Props) {
  const t = translations[lang];
  const [merchantCode, setMerchantCode] = useState(initialMerchant ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EarnResult | null>(
    preloadedSession
      ? {
          sessionId: preloadedSession.sessionId,
          otpCode: preloadedSession.otpCode,
          merchantName: preloadedSession.merchantName,
          totalCashback: preloadedSession.totalCashback,
          expiresAt: preloadedSession.expiresAt,
        }
      : null
  );
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [viewState, setViewState] = useState<ViewState>(preloadedSession ? "otp" : "input");
  const [finalMessage, setFinalMessage] = useState<ResolvedMsg | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Auto-submit if merchant pre-filled (only when no preloaded session)
  useEffect(() => {
    if (initialMerchant && !preloadedSession) {
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

  // Poll for redemption result while customer is showing their PIN
  useEffect(() => {
    if (!result || viewState !== "otp") return;

    const poll = async () => {
      try {
        const data = await apiFetch<StatusResult>(`/api/earn/status?sessionId=${result.sessionId}`);
        if (data.status === "redeemed") {
          setFinalMessage(data.customerMessage ?? null);
          setViewState("success");
          onSuccess();
        } else if (data.status === "expired") {
          setFinalMessage(data.customerMessage ?? null);
          setViewState("failed");
        } else if (data.status === "cancelled") {
          onClose();
        }
      } catch {
        // Ignore polling errors silently
      }
    };

    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, viewState]);

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
      setViewState("otp");
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate PIN");
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    if (result && secondsLeft > 0) {
      setCancelling(true);
      try {
        await apiFetch("/api/earn/cancel", {
          method: "POST",
          body: JSON.stringify({ sessionId: result.sessionId }),
        });
      } catch {
        // Non-critical — still close
      }
    }
    onClose();
  }

  const expired = secondsLeft === 0 && result !== null && viewState === "otp";
  const min = Math.floor(secondsLeft / 60);
  const sec = String(secondsLeft % 60).padStart(2, "0");

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 sheet-backdrop"
        onClick={viewState === "input" ? onClose : undefined}
      />
      <div className="fixed bottom-0 left-0 right-0 z-50 max-w-[480px] mx-auto rounded-t-2xl bg-pan-overlay px-5 pt-4 pb-8 shadow-2xl">
        <div className="mx-auto mb-4 w-10 h-1 rounded-full bg-pan-border" />

        {/* INPUT */}
        {viewState === "input" && (
          <>
            <h2 className="text-lg font-bold text-white mb-1">{t.earnTitle}</h2>
            <p className="text-pan-muted text-sm mb-5">{t.earnHint}</p>

            <input
              type="text"
              value={merchantCode}
              onChange={(e) => setMerchantCode(e.target.value)}
              placeholder={t.merchantCodePlaceholder}
              className="w-full rounded-xl bg-pan-card border border-pan-border px-4 py-3 text-white placeholder:text-pan-muted text-sm outline-none focus:border-pan-pink mb-3"
              autoFocus
              autoCapitalize="none"
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />

            {error && <p className="text-pan-pink text-xs mb-3">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl py-3 text-sm font-bold text-pan-muted border border-pan-border cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => submit()}
                disabled={loading || !merchantCode.trim()}
                className="flex-1 rounded-xl py-3 text-sm font-bold text-white cursor-pointer active:opacity-80 disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #f0206a 0%, #c01253 100%)" }}
              >
                {loading ? t.loading : t.getPinBtn}
              </button>
            </div>
          </>
        )}

        {/* OTP */}
        {viewState === "otp" && result && (
          <>
            <h2 className="text-lg font-bold text-white mb-1">{t.showPinTitle}</h2>
            <p className="text-pan-muted text-sm mb-4">{t.showPinHint}</p>

            <div className="flex justify-between items-center bg-pan-card rounded-xl px-4 py-3 mb-4">
              <span className="text-white font-bold text-sm">{result.merchantName}</span>
              <span className="text-pan-gold font-black font-latin">
                Ks {result.totalCashback.toLocaleString("en-US")}
              </span>
            </div>

            <div
              className="rounded-xl px-4 py-5 mb-3 text-center"
              style={{ border: "2px dashed rgba(240,32,106,0.6)", background: "rgba(240,32,106,0.05)" }}
            >
              <p className="text-[11px] font-bold text-pan-pink uppercase tracking-widest mb-2">
                {t.yourPin}
              </p>
              <p
                className="font-black font-latin text-5xl tracking-[0.3em] text-white pin-pop"
                style={{ textShadow: "0 2px 0 rgba(0,0,0,0.3)" }}
              >
                {result.otpCode}
              </p>
              {!expired ? (
                <p className="text-pan-muted text-xs mt-3">{t.waitingCashier(min, sec)}</p>
              ) : (
                <p className="text-pan-pink text-xs mt-3">{t.pinExpiredMsg}</p>
              )}
            </div>

            <p className="text-center text-pan-muted text-xs mb-4">{t.pinValidHint}</p>

            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="w-full rounded-xl py-3 text-sm font-bold text-pan-muted border border-pan-border cursor-pointer disabled:opacity-50"
            >
              {cancelling ? t.cancelling : t.cancel}
            </button>
          </>
        )}

        {/* SUCCESS */}
        {viewState === "success" && (
          <div className="text-center py-4">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-xl font-black text-white mb-3">{t.redeemedTitle}</h2>
            {finalMessage && (
              <div
                className="rounded-xl px-4 py-4 mb-6 text-left"
                style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}
              >
                <p className="text-[13px] text-white leading-relaxed whitespace-pre-line">
                  {finalMessage.text}
                </p>
              </div>
            )}
            <button
              onClick={onClose}
              className="w-full rounded-xl py-3 text-sm font-bold text-white cursor-pointer active:opacity-80"
              style={{ background: "linear-gradient(135deg, #f0206a 0%, #c01253 100%)" }}
            >
              {t.done}
            </button>
          </div>
        )}

        {/* FAILED */}
        {viewState === "failed" && (
          <div className="text-center py-4">
            <div className="text-6xl mb-4">⏰</div>
            <h2 className="text-xl font-black text-white mb-3">{t.failedTitle}</h2>
            {finalMessage && (
              <div
                className="rounded-xl px-4 py-4 mb-6 text-left"
                style={{ background: "rgba(240,32,106,0.08)", border: "1px solid rgba(240,32,106,0.25)" }}
              >
                <p className="text-[13px] text-pan-muted leading-relaxed whitespace-pre-line">
                  {finalMessage.text}
                </p>
              </div>
            )}
            <button
              onClick={onClose}
              className="w-full rounded-xl py-3 text-sm font-bold text-pan-muted border border-pan-border cursor-pointer"
            >
              {t.close}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
