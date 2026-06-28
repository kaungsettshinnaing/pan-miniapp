"use client";

import { useEffect, useState } from "react";
import BalanceHero from "@/components/BalanceHero";
import MerchantCard from "@/components/MerchantCard";
import EarnSheet from "@/components/EarnSheet";
import ProfileSheet from "@/components/ProfileSheet";
import MerchantProcessSheet from "@/components/MerchantProcessSheet";
import TemplateEditorSheet from "@/components/TemplateEditorSheet";

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

  const tgUser = typeof window !== "undefined"
    ? window.Telegram?.WebApp?.initDataUnsafe?.user
    : null;
  const firstName = tgUser?.first_name ?? "there";

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
    }
    load();
    loadMerchantMeta();
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

  async function loadMerchantMeta() {
    try {
      const data = await apiFetch<MerchantMeta>("/api/merchant/me");
      setMerchantMeta(data);
    } catch {
      // Non-fatal — user is just a customer
    }
  }

  async function loadProfile() {
    try {
      const data = await apiFetch<ProfileData>("/api/profile");
      setProfile(data);
    } catch {
      // Non-fatal — show empty profile
    }
    setProfileOpen(true);
  }

  function openEarn(merchantURL?: string) {
    setEarnMerchant(merchantURL);
    setEarnOpen(true);
  }

  const isMerchant = merchantMeta?.isMerchant ?? false;

  return (
    <main
      className="max-w-[480px] mx-auto min-h-screen bg-pan-navy px-4 pt-4"
      style={{ paddingBottom: isMerchant ? "96px" : "32px" }}
    >
      {/* Header */}
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-pan-card flex items-center justify-center text-lg font-bold text-pan-pink">
            ပ
          </div>
          <div>
            <p className="text-[11px] text-pan-muted leading-tight">ပြန်အမ်းငွေ — Cashback</p>
            <p className="text-[10px] text-pan-muted">Smart Cashback · Loyal Customers</p>
          </div>
        </div>
        <button onClick={loadProfile} className="text-right cursor-pointer">
          <p className="text-[11px] text-pan-muted">Welcome back</p>
          <p className="text-sm font-bold text-white">{firstName}</p>
          <p className="text-[11px] text-pan-pink">My Profile →</p>
        </button>
      </header>

      {/* Customer Tab Content */}
      {tab === "customer" && (
        <>
          {/* Balance Hero */}
          {loading ? (
            <div className="rounded-2xl bg-pan-card h-32 animate-pulse mb-4" />
          ) : error ? (
            <div className="rounded-2xl bg-pan-card p-4 mb-4 text-center">
              <p className="text-pan-muted text-sm mb-2">{error}</p>
              <button onClick={load} className="text-pan-pink text-sm font-bold">
                Retry
              </button>
            </div>
          ) : (
            <BalanceHero
              totalBalance={balance?.totalBalance ?? 0}
              merchantCount={new Set(balance?.cashbacks.map((c) => c.merchantURL)).size}
              expiringCount={balance?.expiringCount ?? 0}
            />
          )}

          {/* Earn Cashback CTA */}
          <button
            onClick={() => openEarn()}
            className="w-full rounded-2xl py-4 font-bold text-lg text-white mb-6 cursor-pointer active:opacity-80 transition-opacity"
            style={{
              background: "linear-gradient(135deg, #f5a623 0%, #f0206a 100%)",
              boxShadow: "0 4px 16px rgba(240,32,106,0.4)",
            }}
          >
            🏷️ Earn Cashback
          </button>

          {/* Cashback List */}
          {!loading && !error && (
            <section>
              <p className="text-[13px] font-bold text-pan-muted uppercase tracking-wide mb-3">
                Your Cashback
              </p>
              {balance?.cashbacks.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-pan-muted text-sm">No active cashback yet.</p>
                  <p className="text-pan-muted text-xs mt-1">
                    Visit a merchant and tap Earn Cashback to get started.
                  </p>
                </div>
              ) : (
                balance?.cashbacks.map((c) => (
                  <MerchantCard
                    key={c.id}
                    cashback={c}
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
          {/* Merchant identity */}
          <div className="rounded-2xl bg-pan-card border border-pan-border px-4 py-4 mb-4">
            <p className="text-pan-muted text-xs uppercase tracking-widest font-bold mb-1">
              Merchant Account
            </p>
            <p className="text-white text-lg font-black">{merchantMeta.merchant.merchantName}</p>
            {merchantMeta.merchant.outletName && (
              <p className="text-pan-muted text-sm">{merchantMeta.merchant.outletName}</p>
            )}
            <p className="text-pan-gold text-xs mt-2 font-bold">
              Earn:{" "}
              {merchantMeta.merchant.earnType === "PERCENTAGE"
                ? `${merchantMeta.merchant.earnValue}% cashback`
                : `Ks ${merchantMeta.merchant.earnValue} fixed`}
            </p>
          </div>

          {/* Process Redemption CTA */}
          <button
            onClick={() => setMerchantOpen(true)}
            className="w-full rounded-2xl py-5 font-bold text-lg text-white mb-4 cursor-pointer active:opacity-80 transition-opacity"
            style={{
              background: "linear-gradient(135deg, #1e3166 0%, #2a3f6f 100%)",
              border: "2px solid rgba(240,32,106,0.5)",
              boxShadow: "0 4px 16px rgba(240,32,106,0.2)",
            }}
          >
            🔢 Process Redemption
            <p className="text-pan-muted text-sm font-normal mt-1">
              Enter customer PIN + purchase amount
            </p>
          </button>

          {/* Message templates */}
          <button
            onClick={() => setTemplatesOpen(true)}
            className="w-full rounded-2xl py-4 font-bold text-base text-white mb-4 cursor-pointer active:opacity-80 transition-opacity border border-pan-border bg-pan-card"
          >
            ✉️ Customize Messages
            <p className="text-pan-muted text-sm font-normal mt-0.5">
              Edit Telegram messages sent to customers
            </p>
          </button>

          {/* Tip about backup channel */}
          <div className="rounded-xl bg-pan-card/60 border border-pan-border px-4 py-3">
            <p className="text-pan-muted text-xs leading-relaxed">
              💡 If this app is unavailable, customers can also redeem via the Telegram bot
              — both channels hit the same database.
            </p>
          </div>
        </div>
      )}

      {/* Bottom nav — only shown when user is also a merchant */}
      {isMerchant && (
        <nav className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-pan-overlay border-t border-pan-border flex z-30">
          <button
            onClick={() => setTab("customer")}
            className="flex-1 py-4 flex flex-col items-center gap-1 cursor-pointer transition-colors"
          >
            <span className="text-xl">{tab === "customer" ? "💰" : "👤"}</span>
            <span
              className={`text-[11px] font-bold ${
                tab === "customer" ? "text-pan-pink" : "text-pan-muted"
              }`}
            >
              My Cashback
            </span>
          </button>
          <div className="w-px bg-pan-border my-2" />
          <button
            onClick={() => setTab("merchant")}
            className="flex-1 py-4 flex flex-col items-center gap-1 cursor-pointer transition-colors"
          >
            <span className="text-xl">🏪</span>
            <span
              className={`text-[11px] font-bold ${
                tab === "merchant" ? "text-pan-pink" : "text-pan-muted"
              }`}
            >
              Merchant
            </span>
          </button>
        </nav>
      )}

      {/* Sheets */}
      {earnOpen && (
        <EarnSheet
          initialMerchant={earnMerchant}
          apiFetch={apiFetch}
          onClose={() => {
            setEarnOpen(false);
            setEarnMerchant(undefined);
          }}
          onSuccess={load}
        />
      )}
      {profileOpen && (
        <ProfileSheet
          profile={profile}
          onClose={() => setProfileOpen(false)}
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
