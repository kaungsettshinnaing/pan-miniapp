"use client";

import { useEffect, useState } from "react";
import BalanceHero from "@/components/BalanceHero";
import MerchantCard from "@/components/MerchantCard";
import EarnSheet from "@/components/EarnSheet";
import ProfileSheet from "@/components/ProfileSheet";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [earnOpen, setEarnOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
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

  async function loadProfile() {
    try {
      const data = await apiFetch<ProfileData>("/api/profile");
      setProfile(data);
    } catch {
      // profile load failure is non-fatal — show empty profile
    }
    setProfileOpen(true);
  }

  function openEarn(merchantURL?: string) {
    setEarnMerchant(merchantURL);
    setEarnOpen(true);
  }

  return (
    <main className="max-w-[480px] mx-auto min-h-screen bg-pan-navy px-4 pt-4 pb-32">
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
    </main>
  );
}
