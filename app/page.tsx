"use client";

import { useEffect, useState } from "react";
import BalanceHero from "@/components/BalanceHero";
import MerchantCard from "@/components/MerchantCard";
import EarnSheet, { type PreloadedSession } from "@/components/EarnSheet";
import ProfileSheet from "@/components/ProfileSheet";
import MerchantProcessSheet from "@/components/MerchantProcessSheet";
import TemplateEditorSheet from "@/components/TemplateEditorSheet";
import { translations, type Lang } from "@/lib/i18n";
import { highlight } from "@/lib/highlight";

type Cashback = {
  id: string;
  merchantURL: string;
  merchantName: string;
  outletName?: string;
  merchantActive: boolean;
  cashbackAmt: number;
  expiryDate: string;
};

type BalanceData = {
  totalBalance: number;
  expiringCount: number;
  cashbacks: Cashback[];
};

type ProfileData = {
  telegramID: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  phoneNumber?: string;
  birthday?: string | null;
  totalBalance: number;
  activeMerchants: number;
  timesRedeemed: number;
};

type MerchantMeta = {
  isMerchant: boolean;
  merchant: {
    merchantURL: string;
    merchantName: string;
    outletName?: string;
    earnType: string;
    earnValue: number;
  } | null;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
          };
        };
        ready: () => void;
        expand: () => void;
      };
    };
  }
}

export function getInitData(): string {
  return window.Telegram?.WebApp?.initData ?? "";
}

export async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "x-telegram-init-data": getInitData(),
      ...(opts?.headers ?? {}),
    },
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error ?? "Request failed");
  return json.data as T;
}

export default function Home() {
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [merchantMeta, setMerchantMeta] = useState<MerchantMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"customer" | "merchant">("customer");
  const [earnOpen, setEarnOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [merchantOpen, setMerchantOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [earnMerchant, setEarnMerchant] = useState<string | undefined>();
  const [preloadedSession, setPreloadedSession] = useState<PreloadedSession | undefined>();
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pan_lang") as Lang | null;
      if (saved === "EN" || saved === "MM") return saved;
    }
    return "MM";
  });

  function setLang(l: Lang) {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("pan_lang", l);
  }

  const t = translations[lang];

  const tgUser = typeof window !== "undefined"
    ? window.Telegram?.WebApp?.initDataUnsafe?.user
    : null;
  const displayName = profile?.firstName ?? tgUser?.first_name ?? "there";

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
    }
    load();
    loadMerchantMeta();
    checkActiveSession();
    refreshProfile();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<BalanceData>("/api/balance");
      setBalance(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function checkActiveSession() {
    try {
      const data = await apiFetch<{ session: PreloadedSession | null }>("/api/earn/active");
      if (data.session) {
        setPreloadedSession(data.session);
        setEarnOpen(true);
      }
    } catch {
      // Non-critical
    }
  }

  async function loadMerchantMeta() {
    try {
      const data = await apiFetch<MerchantMeta>("/api/merchant/me");
      setMerchantMeta(data);
    } catch {
      // Non-fatal
    }
  }

  async function refreshProfile() {
    try {
      const data = await apiFetch<ProfileData>("/api/profile");
      setProfile(data);
    } catch {
      // Non-fatal
    }
  }

  async function openProfile() {
    await refreshProfile();
    setProfileOpen(true);
  }

  function openEarn(merchantURL?: string) {
    setEarnMerchant(merchantURL);
    setEarnOpen(true);
  }

  const isMerchant = merchantMeta?.isMerchant ?? false;

  function LangToggle() {
    return (
      <div className="flex rounded-full border border-pan-border overflow-hidden text-xs font-bold">
        <button
          onClick={() => setLang("EN")}
          className={`px-2.5 py-1 cursor-pointer transition-colors ${
            lang === "EN" ? "text-white" : "text-pan-muted"
          }`}
          style={lang === "EN" ? { background: "linear-gradient(135deg, #f0206a 0%, #c01253 100%)" } : {}}
        >
          EN
        </button>
        <button
          onClick={() => setLang("MM")}
          className={`px-2.5 py-1 cursor-pointer transition-colors ${
            lang === "MM" ? "text-white" : "text-pan-muted"
          }`}
          style={lang === "MM" ? { background: "linear-gradient(135deg, #f0206a 0%, #c01253 100%)" } : {}}
        >
          MM
        </button>
      </div>
    );
  }

  return (
    <main
      className="max-w-[480px] mx-auto min-h-screen bg-pan-navy px-4 pt-4"
      style={{ paddingBottom: isMerchant ? "96px" : "32px" }}
    >
      {/* Header */}
      <header className="flex items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="PAN"
            className="w-10 h-10 object-contain flex-shrink-0 rounded-xl"
          />
          <p className="text-sm font-bold text-white truncate">
            {t.welcomeBack}, {displayName}!
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <LangToggle />
          <button
            onClick={openProfile}
            className="text-[11px] text-pan-pink cursor-pointer whitespace-nowrap"
          >
            {t.myProfile}
          </button>
        </div>
      </header>

      {/* Customer Tab Content */}
      {tab === "customer" && (
        <>
          {loading ? (
            <div className="rounded-2xl bg-pan-card h-32 animate-pulse mb-4" />
          ) : error ? (
            <div className="rounded-2xl bg-pan-card p-4 mb-4 text-center">
              <p className="text-pan-muted text-sm mb-2">{error}</p>
              <button onClick={load} className="text-pan-pink text-sm font-bold">
                {t.retry}
              </button>
            </div>
          ) : (
            <BalanceHero
              totalBalance={balance?.totalBalance ?? 0}
              merchantCount={new Set(balance?.cashbacks.map((c) => c.merchantURL)).size}
              expiringCount={balance?.expiringCount ?? 0}
              lang={lang}
            />
          )}

          <button
            onClick={() => openEarn()}
            className="w-full rounded-2xl py-4 font-bold text-lg text-white mb-6 cursor-pointer active:opacity-80 transition-opacity"
            style={{
              background: "linear-gradient(135deg, #f5a623 0%, #f0206a 100%)",
              boxShadow: "0 4px 16px rgba(240,32,106,0.4)",
            }}
          >
            {highlight(t.earnCashbackBtn)}
          </button>

          {!loading && !error && (
            <section>
              <p className="text-[13px] font-bold text-pan-muted uppercase tracking-wide mb-3">
                {highlight(t.yourCashback)}
              </p>
              {balance?.cashbacks.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-pan-muted text-sm">{highlight(t.noActiveCashback)}</p>
                  <p className="text-pan-muted text-xs mt-1">{highlight(t.noActiveCashbackHint)}</p>
                </div>
              ) : (
                balance?.cashbacks.map((c) => (
                  <MerchantCard
                    key={c.id}
                    cashback={c}
                    lang={lang}
                    onRedeem={() => openEarn(c.merchantURL)}
                  />
                ))
              )}
            </section>
          )}
        </>
      )}

      {/* Merchant Tab Content */}
      {tab === "merchant" && isMerchant && merchantMeta?.merchant && (
        <div className="pt-2">
          <div className="rounded-2xl bg-pan-card border border-pan-border px-4 py-4 mb-4">
            <p className="text-pan-muted text-xs uppercase tracking-widest font-bold mb-1">
              {t.merchantAccount}
            </p>
            <p className="text-white text-lg font-black">{merchantMeta.merchant.merchantName}</p>
            {merchantMeta.merchant.outletName && (
              <p className="text-pan-muted text-sm">{merchantMeta.merchant.outletName}</p>
            )}
            <p className="text-pan-gold text-xs mt-2 font-bold">
              {t.earnLabel}:{" "}
              {highlight(merchantMeta.merchant.earnType === "PERCENTAGE"
                ? t.percentageCashback(merchantMeta.merchant.earnValue)
                : t.fixedCashback(merchantMeta.merchant.earnValue))}
            </p>
          </div>

          <button
            onClick={() => setMerchantOpen(true)}
            className="w-full rounded-2xl py-5 font-bold text-lg text-white mb-4 cursor-pointer active:opacity-80 transition-opacity"
            style={{
              background: "linear-gradient(135deg, #1e3166 0%, #2a3f6f 100%)",
              border: "2px solid rgba(240,32,106,0.5)",
              boxShadow: "0 4px 16px rgba(240,32,106,0.2)",
            }}
          >
            {highlight(t.processRedemption)}
            <p className="text-pan-muted text-sm font-normal mt-1">{t.processRedemptionHint}</p>
          </button>

          <button
            onClick={() => setTemplatesOpen(true)}
            className="w-full rounded-2xl py-4 font-bold text-base text-white mb-4 cursor-pointer active:opacity-80 transition-opacity border border-pan-border bg-pan-card"
          >
            {t.customizeMessages}
            <p className="text-pan-muted text-sm font-normal mt-0.5">{t.customizeMessagesHint}</p>
          </button>

          <div className="rounded-xl bg-pan-card/60 border border-pan-border px-4 py-3">
            <p className="text-pan-muted text-xs leading-relaxed">{t.backupTip}</p>
          </div>
        </div>
      )}

      {/* Bottom nav */}
      {isMerchant && (
        <nav className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-pan-overlay border-t border-pan-border flex z-30">
          <button
            onClick={() => setTab("customer")}
            className="flex-1 py-4 flex flex-col items-center gap-1 cursor-pointer transition-colors"
          >
            <span className="text-xl">{tab === "customer" ? "💰" : "👤"}</span>
            <span className={`text-[11px] font-bold ${tab === "customer" ? "text-pan-pink" : "text-pan-muted"}`}>
              {highlight(t.myCashbackTab)}
            </span>
          </button>
          <div className="w-px bg-pan-border my-2" />
          <button
            onClick={() => setTab("merchant")}
            className="flex-1 py-4 flex flex-col items-center gap-1 cursor-pointer transition-colors"
          >
            <span className="text-xl">🏪</span>
            <span className={`text-[11px] font-bold ${tab === "merchant" ? "text-pan-pink" : "text-pan-muted"}`}>
              {t.merchantTab}
            </span>
          </button>
        </nav>
      )}

      {/* Sheets */}
      {earnOpen && (
        <EarnSheet
          initialMerchant={earnMerchant}
          preloadedSession={preloadedSession}
          lang={lang}
          apiFetch={apiFetch}
          onClose={() => {
            setEarnOpen(false);
            setEarnMerchant(undefined);
            setPreloadedSession(undefined);
            load();
          }}
          onSuccess={load}
        />
      )}
      {profileOpen && (
        <ProfileSheet
          profile={profile}
          lang={lang}
          setLang={setLang}
          apiFetch={apiFetch}
          onClose={() => setProfileOpen(false)}
          onSaved={refreshProfile}
        />
      )}
      {merchantOpen && merchantMeta?.merchant && (
        <MerchantProcessSheet
          merchantName={merchantMeta.merchant.merchantName}
          apiFetch={apiFetch}
          onClose={() => setMerchantOpen(false)}
        />
      )}
      {templatesOpen && (
        <TemplateEditorSheet
          apiFetch={apiFetch}
          onClose={() => setTemplatesOpen(false)}
        />
      )}
    </main>
  );
}
