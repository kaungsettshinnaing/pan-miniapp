"use client";

import { useState } from "react";
import { translations, type Lang } from "@/lib/i18n";

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

type Props = {
  profile: ProfileData | null;
  lang: Lang;
  setLang: (l: Lang) => void;
  apiFetch: <T>(path: string, opts?: RequestInit) => Promise<T>;
  onClose: () => void;
  onSaved: () => void;
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 85 }, (_, i) => CURRENT_YEAR - 5 - i);

function parseBirthday(iso: string | null | undefined) {
  if (!iso) return { day: "", month: "", year: "" };
  const [y, m, d] = iso.split("-");
  return {
    year: y ?? "",
    month: m ? String(parseInt(m) - 1) : "",
    day: d ? String(parseInt(d)) : "",
  };
}

function buildBirthday(day: string, month: string, year: string): string | null {
  if (!day || month === "" || !year) return null;
  const mm = String(parseInt(month) + 1).padStart(2, "0");
  const dd = String(parseInt(day)).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export default function ProfileSheet({ profile, lang, setLang, apiFetch, onClose, onSaved }: Props) {
  const t = translations[lang];
  const parsed = parseBirthday(profile?.birthday);

  const [firstName, setFirstName] = useState(profile?.firstName ?? "");
  const [phoneNumber, setPhoneNumber] = useState(profile?.phoneNumber ?? "");
  const [bdDay, setBdDay] = useState(parsed.day);
  const [bdMonth, setBdMonth] = useState(parsed.month);
  const [bdYear, setBdYear] = useState(parsed.year);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const initial = firstName.charAt(0).toUpperCase() || profile?.firstName?.charAt(0)?.toUpperCase() || "?";
  const linkedAccount = profile?.username ? `@${profile.username}` : profile?.telegramID ?? "—";
  const birthday = buildBirthday(bdDay, bdMonth, bdYear);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await apiFetch("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          firstName: firstName || undefined,
          phoneNumber: phoneNumber || undefined,
          birthday,
        }),
      });
      onSaved();
      onClose();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const selectClass =
    "rounded-xl bg-pan-card border border-pan-border px-3 py-3 text-white text-sm outline-none focus:border-pan-pink [color-scheme:dark] cursor-pointer appearance-none";

  function LangToggle() {
    return (
      <div className="flex rounded-full border border-pan-border overflow-hidden text-xs font-bold">
        <button
          onClick={() => setLang("EN")}
          className={`px-3 py-1.5 cursor-pointer transition-colors ${lang === "EN" ? "text-white" : "text-pan-muted"}`}
          style={lang === "EN" ? { background: "linear-gradient(135deg, #f0206a 0%, #c01253 100%)" } : {}}
        >
          EN
        </button>
        <button
          onClick={() => setLang("MM")}
          className={`px-3 py-1.5 cursor-pointer transition-colors ${lang === "MM" ? "text-white" : "text-pan-muted"}`}
          style={lang === "MM" ? { background: "linear-gradient(135deg, #f0206a 0%, #c01253 100%)" } : {}}
        >
          MM
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 sheet-backdrop" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 max-w-[480px] mx-auto rounded-t-2xl bg-pan-overlay px-5 pt-4 pb-8 shadow-2xl overflow-y-auto max-h-[92vh]">
        <div className="mx-auto mb-4 w-10 h-1 rounded-full bg-pan-border" />

        {/* Header row */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">{t.profileTitle}</h2>
          <LangToggle />
        </div>

        {/* Avatar */}
        <div className="flex flex-col items-center mb-6">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black text-white mb-2"
            style={{ background: "linear-gradient(135deg, #f5a623 0%, #f0206a 100%)" }}
          >
            {initial}
          </div>
          <p className="text-xs text-pan-muted">{linkedAccount}</p>
        </div>

        {/* Editable fields */}
        <div className="space-y-3 mb-5">
          {/* Name */}
          <div>
            <p className="text-[11px] font-bold text-pan-muted uppercase tracking-widest mb-1">
              {t.firstNameLabel}
            </p>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder={t.firstNamePlaceholder}
              className="w-full rounded-xl bg-pan-card border border-pan-border px-4 py-3 text-white placeholder:text-pan-muted text-sm outline-none focus:border-pan-pink"
            />
          </div>

          {/* Phone */}
          <div>
            <p className="text-[11px] font-bold text-pan-muted uppercase tracking-widest mb-1">
              {t.phoneLabel}
            </p>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder={t.phonePlaceholder}
              className="w-full rounded-xl bg-pan-card border border-pan-border px-4 py-3 text-white placeholder:text-pan-muted text-sm outline-none focus:border-pan-pink"
            />
          </div>

          {/* Birthday — DD / MMM / YYYY selects */}
          <div>
            <p className="text-[11px] font-bold text-pan-muted uppercase tracking-widest mb-1">
              {t.birthdayLabel}
            </p>
            <div className="flex gap-2">
              {/* Day */}
              <select
                value={bdDay}
                onChange={(e) => setBdDay(e.target.value)}
                className={`flex-1 ${selectClass}`}
              >
                <option value="">DD</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{String(d).padStart(2, "0")}</option>
                ))}
              </select>

              {/* Month */}
              <select
                value={bdMonth}
                onChange={(e) => setBdMonth(e.target.value)}
                className={`flex-[1.2] ${selectClass}`}
              >
                <option value="">MMM</option>
                {MONTHS.map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>

              {/* Year */}
              <select
                value={bdYear}
                onChange={(e) => setBdYear(e.target.value)}
                className={`flex-[1.5] ${selectClass}`}
              >
                <option value="">YYYY</option>
                {YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Linked account */}
        <div className="rounded-xl bg-pan-card border border-pan-border px-4 py-3 mb-5">
          <div className="flex justify-between items-center">
            <span className="text-pan-muted text-sm">{t.linkedAccount}</span>
            <span className="text-white text-sm font-bold">{linkedAccount}</span>
          </div>
        </div>

        {saveError && (
          <p className="text-pan-pink text-xs mb-3 text-center">{saveError}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl py-3 text-sm font-bold text-pan-muted border border-pan-border cursor-pointer"
          >
            {t.cancel}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-xl py-3 text-sm font-bold text-white cursor-pointer active:opacity-80 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #f0206a 0%, #c01253 100%)" }}
          >
            {saving ? t.saving : t.save}
          </button>
        </div>
      </div>
    </>
  );
}
