import { useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  CreditCard,
  LockKeyhole,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import "./_group.css";

export function Dashboard() {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <main className="vexa-card-page min-h-[100dvh] w-full overflow-y-auto bg-[#f4f2eb] text-[#172c28]">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col px-5 pb-8 pt-[max(18px,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between">
          <div className="flex h-10 items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-[#233e36] text-[11px] font-semibold tracking-[-0.06em] text-[#dfe7c5]">
              v.
            </span>
            <span className="text-[12px] font-semibold tracking-[-0.02em] text-[#43554b]">Vexa</span>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#839084]">Cards</span>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e5e8d9] text-[11px] font-semibold tracking-wide text-[#52634f]">
            VO
          </div>
        </header>

        <section className="mt-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#dedfd3] bg-[#eeeee4] px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#aa6e4f]" />
            <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#657269]">
              Card services · not connected
            </span>
          </div>
          <h1 className="mt-5 max-w-[330px] font-['Instrument_Serif',Georgia,serif] text-[42px] leading-[0.98] tracking-[-0.035em] text-[#172c28]">
            Your card,
            <br />
            when it’s ready.
          </h1>
          <p className="mt-3 max-w-[340px] text-[13px] leading-[1.65] text-[#68766e]">
            We’ll show your card here once a card provider is connected to Vexa.
          </p>
        </section>

        <section className="mt-7" aria-label="Card not issued">
          <div className="relative min-h-[218px] overflow-hidden rounded-[25px] border border-[#d8d9cd] bg-[#e9e8dc] px-5 py-5 shadow-[0_15px_38px_rgba(43,57,44,0.07)]">
            <div className="absolute -right-10 -top-16 h-52 w-52 rounded-full border border-[#d5d8c8]" />
            <div className="absolute -right-1 -top-7 h-36 w-36 rounded-full border border-[#d5d8c8]" />
            <div className="absolute bottom-[-92px] left-[42%] h-52 w-52 rounded-full border border-[#d5d8c8]" />
            <div className="relative flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#d2d4c8] bg-[#f1f0e7] text-[#53655b]">
                <CreditCard size={19} strokeWidth={1.5} />
              </div>
              <span className="rounded-full border border-[#d1d3c6] bg-[#efeee5]/90 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.15em] text-[#6d786f]">
                Not issued
              </span>
            </div>
            <div className="relative mt-7">
              <p className="font-['Instrument_Serif',Georgia,serif] text-[27px] leading-none tracking-[-0.02em] text-[#526158]">
                A little more
                <br />
                room to move.
              </p>
              <p className="mt-3 text-[10px] font-medium uppercase tracking-[0.16em] text-[#80877c]">
                Your Vexa card will live here
              </p>
            </div>
            <div className="absolute bottom-5 right-5 flex h-9 w-9 items-center justify-center rounded-full border border-[#d3d5c8] bg-[#efeee5]/75 text-[#727d72]">
              <LockKeyhole size={15} strokeWidth={1.6} />
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[22px] border border-[#e1e1d8] bg-[#faf9f4] p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#edf0e3] text-[#667653]">
              <ShieldCheck size={18} strokeWidth={1.6} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] font-semibold tracking-[-0.01em] text-[#263b33]">
                  Issuer connection
                </p>
                <span className="shrink-0 rounded-full bg-[#f2e9df] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#966d52]">
                  Not connected
                </span>
              </div>
              <p className="mt-1.5 text-[11px] leading-[1.55] text-[#758078]">
                No card issuer or custodian is connected to this app.
              </p>
            </div>
          </div>
          <div className="my-4 h-px bg-[#e8e8df]" />
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f1f0e7] text-[#778078]">
              <WifiOff size={17} strokeWidth={1.6} />
            </div>
            <div className="flex-1">
              <p className="text-[12px] font-semibold text-[#35463e]">No card activity yet</p>
              <p className="mt-0.5 text-[11px] text-[#758078]">
                There’s no card feed to update in real time.
              </p>
            </div>
            <span className="rounded-full border border-[#e1e1d8] px-2 py-1 text-[9px] font-medium text-[#788178]">
              Not available
            </span>
          </div>
        </section>

        <section className="mt-6">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#8a9285]">
                What happens next
              </p>
              <h2 className="mt-1.5 font-['Instrument_Serif',Georgia,serif] text-[26px] leading-none tracking-[-0.02em] text-[#263b33]">
                Three clear steps.
              </h2>
            </div>
            <span className="pb-0.5 font-mono text-[10px] text-[#8a9285]">01—03</span>
          </div>
          <div className="mt-4 space-y-0">
            {[
              {
                number: "01",
                title: "A provider connects",
                copy: "Vexa needs a card issuer and custodian first.",
                done: false,
              },
              {
                number: "02",
                title: "Your card is issued",
                copy: "Only then will card details appear here.",
                done: false,
              },
              {
                number: "03",
                title: "Card activity becomes available",
                copy: "Transactions and controls follow issuance.",
                done: false,
              },
            ].map((step, index) => (
              <div key={step.number} className="relative flex gap-3.5 pb-4">
                {index < 2 && (
                  <span className="absolute left-[15px] top-[34px] h-[calc(100%-24px)] w-px bg-[#dedfd4]" />
                )}
                <div className="relative z-10 flex h-[31px] w-[31px] shrink-0 items-center justify-center rounded-full border border-[#dcded2] bg-[#f4f2eb] font-mono text-[9px] text-[#849083]">
                  {step.done ? <Check size={13} /> : step.number}
                </div>
                <div className="pt-0.5">
                  <p className="text-[12px] font-semibold text-[#33473d]">{step.title}</p>
                  <p className="mt-1 text-[11px] leading-[1.45] text-[#79847b]">{step.copy}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-1 rounded-[18px] border border-[#e1e1d8] bg-[#faf9f4]">
          <button
            type="button"
            onClick={() => setShowDetails((value) => !value)}
            aria-expanded={showDetails}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
          >
            <CircleHelp size={17} strokeWidth={1.6} className="text-[#778278]" />
            <span className="flex-1 text-[12px] font-medium text-[#45574d]">
              Why can’t I use a card yet?
            </span>
            <ChevronDown
              size={16}
              strokeWidth={1.7}
              className={`text-[#7c877d] transition-transform duration-200 ${showDetails ? "rotate-180" : ""}`}
            />
          </button>
          {showDetails && (
            <div className="border-t border-[#e8e8df] px-4 pb-4 pt-3">
              <p className="text-[11px] leading-[1.65] text-[#718077]">
                Vexa hasn’t connected a card issuer or custodian yet, so no card has been issued in this app. We’ll only display card details and activity once those services are in place.
              </p>
            </div>
          )}
        </section>

        <footer className="mt-auto flex items-center justify-between gap-3 pt-7">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} strokeWidth={1.7} className="text-[#778779]" />
            <span className="text-[10px] text-[#828b80]">Your details stay private</span>
          </div>
          <button
            type="button"
            onClick={() => setShowDetails((value) => !value)}
            className="flex items-center gap-1 text-[10px] font-medium text-[#607168]"
          >
            Card help <ArrowRight size={12} strokeWidth={1.7} />
          </button>
        </footer>
      </div>
      <style>{`
        .vexa-card-page {
          font-family: "Plus Jakarta Sans", "DM Sans", ui-sans-serif, system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .vexa-card-page button { cursor: pointer; }
        .vexa-card-page button:focus-visible {
          outline: 2px solid #75885b;
          outline-offset: 3px;
        }
      `}</style>
    </main>
  );
}
