import { translations, type Lang } from "@/lib/i18n";
import { highlight } from "@/lib/highlight";

type Props = {
  totalBalance: number;
  merchantCount: number;
  expiringCount: number;
  lang: Lang;
};

export default function BalanceHero({ totalBalance, merchantCount, expiringCount, lang }: Props) {
  const t = translations[lang];

  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-pan-card px-5 pt-5 pb-6 mb-4"
      style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.3)" }}
    >
      <span className="absolute -right-12 -top-16 w-44 h-44 rounded-full opacity-20" style={{ background: "#f0206a" }} />
      <span className="absolute -left-8 -bottom-10 w-28 h-28 rounded-full opacity-10" style={{ background: "#f0206a" }} />

      <p className="relative text-[11px] text-pan-muted uppercase tracking-widest mb-1">
        {highlight(t.totalBalance)}
      </p>
      <div className="relative flex items-baseline gap-2 mb-4">
        <span className="text-sm font-bold text-white">Ks</span>
        <span
          className="text-5xl font-black text-pan-gold font-latin leading-none"
          style={{ textShadow: "0 2px 0 rgba(0,0,0,0.2)" }}
        >
          {totalBalance.toLocaleString("en-US")}
        </span>
      </div>

      <div className="relative flex items-center gap-3">
        <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold text-white">
          {t.merchantSuffix(merchantCount)}
        </span>
        {expiringCount > 0 && (
          <span className="rounded-full bg-pan-pink/20 px-3 py-1 text-[11px] font-bold text-pan-pink">
            {t.expiringSoon(expiringCount)}
          </span>
        )}
      </div>
    </div>
  );
}
