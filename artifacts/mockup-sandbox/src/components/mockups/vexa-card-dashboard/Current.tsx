import { useState } from "react";
import "./_group.css";

const useLocation = (): [string, (path: string) => void] => ["/", () => {}];
const useAuth = () => ({ user: { name: "Vexa User" } });

export function Current() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [frozen, setFrozen] = useState(false);
  const [showNum, setShowNum] = useState(false);
  const [activeTab, setCardTab] = useState<"details" | "transactions" | "limits">("details");
  const [onlinePayments, setOnline] = useState(true);
  const [contactless, setContactless] = useState(true);
  const [intlPayments, setIntl] = useState(false);

  const cardName = user ? user.name.split(" ").slice(0, 2).map(p => p.toUpperCase()).join(" ") : "VEXA USER";

  const CARD_TXS = [
    { icon: "🛒", name: "Shoprite", date: "Today, 2:14 PM", amount: "-₦4,500", color: "#EF4444" },
    { icon: "🍔", name: "KFC Nigeria", date: "Yesterday, 7:33 PM", amount: "-₦2,800", color: "#EF4444" },
    { icon: "📱", name: "Jumia Pay", date: "25 Jul, 11:00 AM", amount: "-₦12,000", color: "#EF4444" },
    { icon: "🎬", name: "Netflix", date: "23 Jul, 12:01 AM", amount: "-₦4,600", color: "#EF4444" },
    { icon: "⛽", name: "MRS Fuel", date: "20 Jul, 08:45 AM", amount: "-₦8,000", color: "#EF4444" },
  ];

  return (
    <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="flex-none flex items-center justify-between px-4 pb-3 bg-white border-b border-[#E8EBF0]"
        style={{ paddingTop: "max(env(safe-area-inset-top), 12px)" }}>
        <button onClick={() => navigate("/")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <span className="text-[16px] font-bold text-[#111]">Vexa Virtual Card</span>
        <div className="w-8" />
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {/* Premium Card Visual */}
        <div className="px-4 pt-5 pb-2">
          <div className="rounded-3xl p-5 text-white relative overflow-hidden select-none"
            style={{
              background: frozen
                ? "linear-gradient(135deg, #374151 0%, #1F2937 60%, #111827 100%)"
                : "linear-gradient(135deg, #0f4f5c 0%, #0e7490 45%, #086477 75%, #064b5a 100%)",
              minHeight: 200,
              transition: "background 0.5s ease",
            }}>
            {/* Holographic shimmer overlay */}
            <div className="absolute inset-0 opacity-[0.06]" style={{
              background: "repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 4px)",
            }} />
            {/* Top row */}
            <div className="relative z-10 flex justify-between items-start mb-6">
              <div>
                <p className="text-[10px] text-white/50 font-semibold uppercase tracking-widest">Vexa Bank</p>
                <p className="text-[11px] text-white/80 font-medium mt-0.5">Virtual Debit Card</p>
              </div>
              {/* Chip */}
              <div className="w-10 h-7 rounded-md bg-gradient-to-br from-yellow-300 to-yellow-500 relative overflow-hidden shadow-lg">
                <div className="absolute inset-0 grid grid-cols-3 gap-px p-0.5 opacity-60">
                  {Array.from({ length: 9 }).map((_, i) => <div key={i} className="bg-yellow-700/50 rounded-[1px]"/>)}
                </div>
              </div>
            </div>
            {/* NFC icon */}
            <div className="relative z-10 mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5">
                <path d="M12 2a10 10 0 0 1 0 20" strokeLinecap="round"/>
                <path d="M12 6a6 6 0 0 1 0 12" strokeLinecap="round"/>
                <path d="M12 10a2 2 0 0 1 0 4" strokeLinecap="round"/>
              </svg>
            </div>
            {/* Card number */}
            <p className="relative z-10 text-[19px] font-bold tracking-[5px] mb-5 font-mono">
              {showNum ? "5399 1234 5678 9012" : "•••• •••• •••• 9012"}
            </p>
            {/* Bottom row */}
            <div className="relative z-10 flex items-end justify-between">
              <div>
                <p className="text-[9px] text-white/40 uppercase tracking-widest font-semibold">Card Holder</p>
                <p className="text-[13px] font-bold tracking-wide mt-0.5">{cardName}</p>
              </div>
              <div>
                <p className="text-[9px] text-white/40 uppercase tracking-widest font-semibold">Expires</p>
                <p className="text-[13px] font-bold mt-0.5">08/29</p>
              </div>
              {/* Mastercard circles */}
              <div className="flex items-center">
                <div className="w-9 h-9 rounded-full opacity-90" style={{ background: "#EB001B" }} />
                <div className="w-9 h-9 rounded-full -ml-4 opacity-90" style={{ background: "#F79E1B", mixBlendMode: "multiply" }} />
              </div>
            </div>
            {/* Frozen overlay */}
            {frozen && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-3xl"
                style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
                <p className="text-white font-bold text-[15px] tracking-wide">❄️ Card Frozen</p>
                <p className="text-white/60 text-[11px]">Tap Unfreeze to re-enable</p>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-4 gap-2.5 px-4 pb-2 pt-1">
          {[
            { label: showNum ? "Hide" : "Show", icon: showNum ? "🙈" : "👁️", action: () => setShowNum(v => !v), active: showNum },
            { label: frozen ? "Unfreeze" : "Freeze", icon: frozen ? "🔓" : "❄️", action: () => setFrozen(v => !v), active: frozen },
            { label: "Change PIN", icon: "🔑", action: () => navigate("/change-pin"), active: false },
            { label: "Block Card", icon: "🚫", action: () => {}, active: false },
          ].map(a => (
            <button key={a.label} onClick={a.action}
              className={`rounded-2xl py-3.5 flex flex-col items-center gap-1.5 border transition-all active:scale-95 ${
                a.active ? "bg-[#162353] border-[#162353]" : "bg-white border-[#F0F0F0]"
              }`}>
              <span className="text-[20px]">{a.icon}</span>
              <span className={`text-[10px] font-semibold text-center leading-tight ${a.active ? "text-white" : "text-[#333]"}`}>{a.label}</span>
            </button>
          ))}
        </div>

        {/* Spending summary strip */}
        <div className="mx-4 mb-3 bg-white rounded-2xl border border-[#F0F0F0] px-4 py-3 flex gap-4">
          <div className="flex-1 text-center">
            <p className="text-[10px] text-[#888] font-medium">Spent Today</p>
            <p className="text-[15px] font-extrabold text-[#EF4444] mt-0.5">₦7,300</p>
          </div>
          <div className="w-px bg-[#F0F0F0]" />
          <div className="flex-1 text-center">
            <p className="text-[10px] text-[#888] font-medium">This Month</p>
            <p className="text-[15px] font-extrabold text-[#EF4444] mt-0.5">₦31,900</p>
          </div>
          <div className="w-px bg-[#F0F0F0]" />
          <div className="flex-1 text-center">
            <p className="text-[10px] text-[#888] font-medium">Daily Limit</p>
            <p className="text-[15px] font-extrabold text-[#162353] mt-0.5">₦500k</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex mx-4 mb-3 bg-[#F0F0F0] rounded-xl p-1">
          {([["details", "Details"], ["transactions", "Transactions"], ["limits", "Controls"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setCardTab(k)}
              className={`flex-1 py-1.5 rounded-lg text-[12px] font-bold transition-all ${activeTab === k ? "bg-white text-[#162353] shadow-sm" : "text-[#888]"}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Details Tab */}
        {activeTab === "details" && (
          <div className="px-4 space-y-3 pb-6">
            <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
              {[
                { label: "Card Type", val: "Mastercard Virtual Debit" },
                { label: "Card Status", val: frozen ? "❄️ Frozen" : "✅ Active" },
                { label: "Card Number", val: showNum ? "5399 1234 5678 9012" : "•••• •••• •••• 9012" },
                { label: "CVV", val: showNum ? "742" : "•••" },
                { label: "Expiry Date", val: "08/29" },
                { label: "Billing Address", val: "Lagos, Nigeria" },
              ].map((d, i, arr) => (
                <div key={d.label} className={`flex items-center justify-between px-4 py-3.5 ${i < arr.length - 1 ? "border-b border-[#F5F5F5]" : ""}`}>
                  <span className="text-[12px] text-[#888]">{d.label}</span>
                  <span className="text-[13px] font-semibold text-[#111] font-mono">{d.val}</span>
                </div>
              ))}
            </div>

            <div className="bg-[#EEF2FF] rounded-2xl p-4 flex items-center justify-between border border-[#C7D7F5]">
              <div>
                <p className="text-[13px] font-bold text-[#162353]">Get a Physical Card</p>
                <p className="text-[11px] text-[#555] mt-0.5">Delivered in 3–5 business days · Free</p>
              </div>
              <button className="bg-[#162353] text-white text-[11px] font-semibold px-3 py-2 rounded-xl">Request</button>
            </div>
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === "transactions" && (
          <div className="px-4 pb-6 space-y-2">
            <p className="text-[11px] font-semibold text-[#888] uppercase tracking-wide px-1 mb-3">Recent Card Transactions</p>
            <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
              {CARD_TXS.map((tx, i) => (
                <div key={tx.name} className={`flex items-center gap-3 px-4 py-3.5 ${i < CARD_TXS.length - 1 ? "border-b border-[#F5F5F5]" : ""}`}>
                  <div className="w-10 h-10 rounded-full bg-[#F8F9FB] flex items-center justify-center text-[20px] shrink-0">{tx.icon}</div>
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold text-[#111]">{tx.name}</p>
                    <p className="text-[11px] text-[#888]">{tx.date}</p>
                  </div>
                  <span className="text-[13px] font-bold text-[#EF4444]">{tx.amount}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Controls Tab */}
        {activeTab === "limits" && (
          <div className="px-4 pb-6 space-y-3">
            <p className="text-[11px] font-semibold text-[#888] uppercase tracking-wide px-1">Payment Controls</p>
            <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
              {[
                { label: "Online Payments", sub: "E-commerce & web transactions", state: onlinePayments, toggle: () => setOnline(v => !v) },
                { label: "Contactless / NFC", sub: "Tap-to-pay at terminals", state: contactless, toggle: () => setContactless(v => !v) },
                { label: "International", sub: "Transactions outside Nigeria", state: intlPayments, toggle: () => setIntl(v => !v) },
              ].map((item, i, arr) => (
                <div key={item.label} className={`flex items-center gap-3 px-4 py-4 ${i < arr.length - 1 ? "border-b border-[#F5F5F5]" : ""}`}>
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold text-[#111]">{item.label}</p>
                    <p className="text-[11px] text-[#888] mt-0.5">{item.sub}</p>
                  </div>
                  <button onClick={item.toggle}
                    className={`w-11 h-6 rounded-full transition-colors relative ${item.state ? "bg-[#162353]" : "bg-[#D1D5DB]"}`}>
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${item.state ? "left-5" : "left-0.5"}`} />
                  </button>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#F5F5F5]">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-[13px] font-semibold text-[#111]">Daily Spend Limit</p>
                    <p className="text-[11px] text-[#888] mt-0.5">Maximum per day</p>
                  </div>
                  <p className="text-[14px] font-bold text-[#162353]">₦500,000</p>
                </div>
                <div className="mt-3 h-2 bg-[#F0F0F0] rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-[#162353]" style={{ width: "6.38%" }} />
                </div>
                <p className="text-[10px] text-[#888] mt-1">₦31,900 used · ₦468,100 remaining</p>
              </div>
              <div className="px-4 py-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-[13px] font-semibold text-[#111]">Monthly Limit</p>
                    <p className="text-[11px] text-[#888] mt-0.5">Maximum per month</p>
                  </div>
                  <p className="text-[14px] font-bold text-[#162353]">₦2,000,000</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
