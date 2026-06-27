type Cashback = {
  id: string;
  merchantURL: string;
  merchantName: string;
  outletName?: string;
  merchantActive: boolean;
  cashbackAmt: number;
  expiryDate: string;
};

type Props = {
  cashback: Cashback;
  onRedeem: () => void;
};

function daysLeft(expiryDate: string): number {
  const expiry = new Date(expiryDate);
  const now = new Date();
  return Math.round((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(expiryDate: string): string {
  return new Date(expiryDate).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function MerchantCard({ cashback, onRedeem }: Props) {
  const days = daysLeft(cashback.expiryDate);
  const isUrgent = days <= 3;
  const isWarning = days <= 7 && !isUrgent;

  return (
    <div className="rounded-xl bg-pan-card border border-pan-border p-4 mb-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="font-bold text-white text-sm">{cashback.merchantName}</p>
          {cashback.outletName && (
            <p className="text-pan-muted text-xs">{cashback.outletName}</p>
          )}
          {days >= 0 && (
            <span
              className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isUrgent
                  ? "bg-pan-pink/20 text-pan-pink"
                  : isWarning
                  ? "bg-amber-500/20 text-amber-400"
                  : "bg-white/10 text-pan-muted"
              }`}
            >
              {isUrgent ? "🔥" : isWarning ? "⏳" : "📅"} {days}d left
            </span>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="font-black text-pan-gold font-latin text-xl leading-none">
            Ks {cashback.cashbackAmt.toLocaleString("en-US")}
          </p>
          <p className="text-[11px] text-pan-muted mt-1">
            Expires {formatDate(cashback.expiryDate)}
          </p>
        </div>
      </div>

      <button
        onClick={onRedeem}
        disabled={!cashback.merchantActive}
        className="w-full rounded-xl py-2.5 text-sm font-bold text-white cursor-pointer active:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: cashback.merchantActive
            ? "linear-gradient(135deg, #f0206a 0%, #c01253 100%)"
            : undefined,
          backgroundColor: cashback.merchantActive ? undefined : "#2a3f6f",
        }}
      >
        {cashback.merchantActive
          ? `Redeem at ${cashback.merchantName} →`
          : "Merchant currently inactive"}
      </button>
    </div>
  );
}
