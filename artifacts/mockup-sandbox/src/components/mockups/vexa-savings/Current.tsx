import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import "./_group.css";

type Goal = {
  id: string;
  name: string;
  emoji: string;
  target: number;
  saved: number;
  frequency: string;
  dueDate: string;
  autoSave: boolean;
  color: string;
};

const goals: Goal[] = [
  { id: "1", name: "Emergency Fund", emoji: "🛡️", target: 200000, saved: 45000, frequency: "Monthly", dueDate: "Dec 2026", autoSave: true, color: "#162353" },
  { id: "2", name: "New Laptop", emoji: "💻", target: 350000, saved: 120000, frequency: "Weekly", dueDate: "Sep 2026", autoSave: false, color: "#0F6CBD" },
  { id: "3", name: "Vacation Fund", emoji: "✈️", target: 500000, saved: 87500, frequency: "Weekly", dueDate: "Jun 2027", autoSave: true, color: "#6D28D9" },
];

const plans = [
  { name: "Flexi Save", rate: "8% p.a.", min: "₦1,000", lock: "None", tag: "Popular", color: "#162353", desc: "Save anytime, withdraw anytime." },
  { name: "Target Save", rate: "12% p.a.", min: "₦5,000", lock: "3 months", tag: "Best Rate", color: "#0F6CBD", desc: "Lock funds, earn higher returns." },
  { name: "Fixed Deposit", rate: "15% p.a.", min: "₦50,000", lock: "6 months", tag: "Highest", color: "#6D28D9", desc: "Maximum interest for committed savers." },
];

const naira = (value: number) => `₦${value.toLocaleString("en-NG")}`;

export function Current() {
  const [activeTab, setActiveTab] = useState<"goals" | "plans">("goals");
  const totalSaved = goals.reduce((sum, goal) => sum + goal.saved, 0);
  const totalTarget = goals.reduce((sum, goal) => sum + goal.target, 0);
  const overallPct = Math.round((totalSaved / totalTarget) * 100);

  return (
    <main className="min-h-screen bg-[#F2F3F5]" style={{ fontFamily: "Inter, sans-serif" }}>
      <header className="flex items-center gap-3 border-b border-[#E8EBF0] bg-white px-4 pb-3 pt-4">
        <button type="button" aria-label="Back" className="flex h-8 w-8 items-center justify-center rounded-full text-[#111]">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-[16px] font-bold text-[#111]">Savings</h1>
      </header>

      <div className="space-y-4 overflow-y-auto px-4 pb-8 pt-4">
        <section className="relative overflow-hidden rounded-2xl text-white" style={{ background: "linear-gradient(135deg, #0f4f5c 0%, #0e7490 50%, #083d49 100%)" }}>
          <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
          <div className="relative p-5">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-white/60">Total Savings</p>
            <p className="text-[30px] font-extrabold tracking-tight">{naira(totalSaved)}.00</p>
            <p className="mt-0.5 text-[11px] text-white/60">Target: {naira(totalTarget)} across {goals.length} goals</p>
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-[10px] text-white/70">Overall progress</p>
                <p className="text-[11px] font-bold">{overallPct}%</p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-white" style={{ width: `${overallPct}%` }} />
              </div>
            </div>
            <div className="mt-4 flex gap-2.5">
              <div className="flex-1 rounded-xl bg-white/10 px-3 py-2.5">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-white/60">Earned Interest</p>
                <p className="mt-0.5 text-[13px] font-bold">₦4,320.00</p>
              </div>
              <div className="flex-1 rounded-xl bg-white/10 px-3 py-2.5">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-white/60">This Month</p>
                <p className="mt-0.5 text-[13px] font-bold">+₦18,500</p>
              </div>
              <div className="flex-1 rounded-xl bg-white/10 px-3 py-2.5">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-white/60">Active Goals</p>
                <p className="mt-0.5 text-[13px] font-bold">{goals.length}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="flex rounded-xl bg-[#F0F0F0] p-1">
          {(["goals", "plans"] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-lg py-2 text-[13px] font-bold capitalize transition-all ${activeTab === tab ? "bg-white text-[#162353] shadow-sm" : "text-[#888]"}`}
            >
              {tab === "goals" ? "🎯 My Goals" : "📈 Savings Plans"}
            </button>
          ))}
        </div>

        {activeTab === "goals" ? (
          <section className="space-y-3">
            {goals.map(goal => {
              const pct = Math.round((goal.saved / goal.target) * 100);
              const remaining = goal.target - goal.saved;
              return (
                <article key={goal.id} className="overflow-hidden rounded-2xl border border-[#F0F0F0] bg-white">
                  <div className="flex items-center gap-3 px-4 py-3" style={{ background: goal.color }}>
                    <span className="text-[22px]">{goal.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-bold text-white">{goal.name}</p>
                      <p className="text-[11px] text-white/60">Due {goal.dueDate} · {goal.frequency}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[18px] font-extrabold text-white">{pct}%</p>
                      <p className="text-[10px] text-white/60">complete</p>
                    </div>
                  </div>
                  <div className="px-4 pb-4 pt-3">
                    <div className="mb-3 h-2.5 overflow-hidden rounded-full bg-[#F0F0F0]">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: goal.color }} />
                    </div>
                    <div className="mb-3 flex justify-between">
                      <div><p className="text-[10px] text-[#888]">Saved</p><p className="text-[13px] font-bold text-[#111]">{naira(goal.saved)}</p></div>
                      <div className="text-center"><p className="text-[10px] text-[#888]">Remaining</p><p className="text-[13px] font-bold text-[#555]">{naira(remaining)}</p></div>
                      <div className="text-right"><p className="text-[10px] text-[#888]">Target</p><p className="text-[13px] font-bold text-[#111]">{naira(goal.target)}</p></div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${goal.autoSave ? "bg-green-100 text-green-700" : "bg-[#F5F5F5] text-[#888]"}`}>
                        ⚡ Auto-save {goal.autoSave ? "on" : "off"}
                      </span>
                      <button type="button" className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-white" style={{ background: goal.color }}>+ Top Up</button>
                    </div>
                  </div>
                </article>
              );
            })}
            <button type="button" className="flex h-[50px] w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#162353]/30 text-[13px] font-semibold text-[#162353]">
              <span className="text-[18px]">+</span> Create New Goal
            </button>
          </section>
        ) : (
          <section className="space-y-3">
            <p className="text-[12px] text-[#888]">Choose a savings plan that suits your lifestyle</p>
            {plans.map(plan => (
              <article key={plan.name} className="overflow-hidden rounded-2xl border border-[#F0F0F0] bg-white">
                <div className="flex items-center justify-between px-4 py-3" style={{ background: plan.color }}>
                  <p className="text-[15px] font-bold text-white">{plan.name}</p>
                  <span className="rounded-full bg-white/20 px-2 py-1 text-[10px] font-bold text-white">{plan.tag}</span>
                </div>
                <div className="p-4">
                  <p className="mb-3 text-[12px] text-[#888]">{plan.desc}</p>
                  <div className="mb-4 flex gap-2">
                    <div className="flex-1 rounded-xl bg-[#F8F9FB] px-2 py-2.5 text-center"><p className="text-[10px] text-[#888]">Interest Rate</p><p className="mt-0.5 text-[16px] font-extrabold text-[#162353]">{plan.rate}</p></div>
                    <div className="flex-1 rounded-xl bg-[#F8F9FB] px-2 py-2.5 text-center"><p className="text-[10px] text-[#888]">Minimum</p><p className="mt-0.5 text-[14px] font-bold text-[#111]">{plan.min}</p></div>
                    <div className="flex-1 rounded-xl bg-[#F8F9FB] px-2 py-2.5 text-center"><p className="text-[10px] text-[#888]">Lock Period</p><p className="mt-0.5 text-[12px] font-bold text-[#111]">{plan.lock}</p></div>
                  </div>
                  <button type="button" className="h-10 w-full rounded-xl text-[13px] font-bold text-white" style={{ background: plan.color }}>Start This Plan</button>
                </div>
              </article>
            ))}
            <aside className="mt-2 rounded-2xl border border-[#C7D7FF] bg-[#F0F4FF] px-4 py-4">
              <p className="mb-1 text-[12px] font-bold text-[#162353]">💡 Did you know?</p>
              <p className="text-[11px] leading-relaxed text-[#555]">Consistent savings of ₦5,000/week grows to over ₦1.4M in 5 years with compound interest at 12% p.a.</p>
            </aside>
          </section>
        )}
      </div>
    </main>
  );
}
