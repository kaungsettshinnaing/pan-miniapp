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

type Props = {
  profile: ProfileData | null;
  onClose: () => void;
};

export default function ProfileSheet({ profile, onClose }: Props) {
  const initial = profile?.firstName?.charAt(0)?.toUpperCase() ?? "?";
  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || "—";

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 sheet-backdrop" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 max-w-[480px] mx-auto rounded-t-2xl bg-pan-overlay px-5 pt-4 pb-10 shadow-2xl">
        {/* Handle */}
        <div className="mx-auto mb-5 w-10 h-1 rounded-full bg-pan-border" />

        {/* Avatar */}
        <div className="flex flex-col items-center mb-6">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black text-white mb-3"
            style={{
              background: "linear-gradient(135deg, #f5a623 0%, #f0206a 100%)",
            }}
          >
            {initial}
          </div>
          <p className="text-xl font-black text-white">{fullName}</p>
        </div>

        {/* Cashback Stats */}
        <p className="text-[11px] font-bold text-pan-muted uppercase tracking-widest mb-2">
          Cashback Stats
        </p>
        <div className="rounded-xl bg-pan-card border border-pan-border divide-y divide-pan-border mb-5">
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-pan-muted text-sm">💰 Total Balance</span>
            <span className="text-pan-gold font-black font-latin">
              Ks {(profile?.totalBalance ?? 0).toLocaleString("en-US")}
            </span>
          </div>
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-pan-muted text-sm">🏪 Active Merchants</span>
            <span className="text-white font-bold">{profile?.activeMerchants ?? 0}</span>
          </div>
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-pan-muted text-sm">✅ Times Redeemed</span>
            <span className="text-white font-bold">{profile?.timesRedeemed ?? 0}</span>
          </div>
        </div>

        {/* Account */}
        <p className="text-[11px] font-bold text-pan-muted uppercase tracking-widest mb-2">
          Account
        </p>
        <div className="rounded-xl bg-pan-card border border-pan-border divide-y divide-pan-border mb-6">
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-pan-muted text-sm">Telegram ID</span>
            <span className="text-white text-sm font-bold">{profile?.telegramID ?? "—"}</span>
          </div>
          {profile?.phoneNumber && (
            <div className="flex justify-between items-center px-4 py-3">
              <span className="text-pan-muted text-sm">Phone</span>
              <span className="text-white text-sm">{profile.phoneNumber}</span>
            </div>
          )}
          {profile?.username && (
            <div className="flex justify-between items-center px-4 py-3">
              <span className="text-pan-muted text-sm">Username</span>
              <span className="text-white text-sm">@{profile.username}</span>
            </div>
          )}
        </div>

        {/* Branding */}
        <div className="text-center mb-5">
          <p className="text-pan-pink text-sm font-bold">ပြန်အမ်းငွေ — Cashback</p>
          <p className="text-pan-muted text-xs">cashbackapp.cloud</p>
        </div>

        <button
          onClick={onClose}
          className="w-full rounded-xl py-3 text-sm font-bold text-white bg-pan-card border border-pan-border cursor-pointer"
        >
          Close
        </button>
      </div>
    </>
  );
}
