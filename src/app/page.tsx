import Link from "next/link";
import { Logo, LogoMark } from "@/components/logo";
import { ButtonLink } from "@/components/ui";
import { getCurrentUser } from "@/lib/session";

const SYSTEMS = [
  { title: "Professional dashboard", body: "Net P&L, win rate, profit factor, expectancy, R multiples, drawdown and an equity curve — calculated from your trades.", status: "Live" },
  { title: "Smart trade journal", body: "Entries, exits, stops, targets, fees, setups, emotions and notes. Results are calculated automatically and exactly.", status: "Live" },
  { title: "CSV imports", body: "Upload a broker export, review every row, then import. Duplicates are detected so re-importing is safe.", status: "Live" },
  { title: "Strategy intelligence", body: "See which setups, instruments and weekdays actually perform — with sample sizes shown.", status: "Live" },
  { title: "Psychology & discipline", body: "Track rule-breaking, emotional state and confidence. EDGEFORGE shows correlations; it never pretends to diagnose.", status: "Live" },
  { title: "AI trading coach", body: "Explains patterns in your data. Every insight will be traceable to the trades behind it.", status: "Planned" },
  { title: "Backtesting & replay", body: "Test strategies on historical data and compare backtests with how you really trade.", status: "Planned" },
  { title: "Broker sync & mobile", body: "Direct broker and exchange imports with reconciliation, on any device.", status: "Planned" },
];

export default async function Home() {
  const user = await getCurrentUser();
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute -top-48 left-1/2 h-[36rem] w-[60rem] -translate-x-1/2 rounded-full bg-brand-violet/15 blur-3xl" />
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2">
          {user ? (
            <ButtonLink href="/dashboard">Open dashboard</ButtonLink>
          ) : (
            <>
              <Link href="/sign-in" className="px-3 py-2 text-sm text-navy-200 hover:text-white">Sign in</Link>
              <ButtonLink href="/sign-up">Get started</ButtonLink>
            </>
          )}
        </nav>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <section className="flex flex-col items-center py-16 text-center sm:py-24">
          <LogoMark className="mb-8 h-28 w-28 sm:h-36 sm:w-36" glow />
          <p className="mb-4 text-xs font-semibold tracking-[0.3em] text-brand-cyan">TRADING INTELLIGENCE PLATFORM</p>
          <h1 className="text-5xl font-bold tracking-tight text-white sm:text-7xl">
            Master your <span className="brand-gradient-text">edge.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-navy-300">
            EDGEFORGE starts with the most accurate trade journal and analytics engine we can build — because no amount of AI can fix
            incorrect trade data or misleading performance numbers.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <ButtonLink href={user ? "/dashboard" : "/sign-up"} className="px-6 py-3 text-base">
              {user ? "Go to your dashboard" : "Start journaling free"}
            </ButtonLink>
            {!user && <ButtonLink href="/sign-in" variant="secondary" className="px-6 py-3 text-base">Sign in</ButtonLink>}
          </div>
        </section>

        <section className="pb-24">
          <h2 className="mb-8 text-center text-sm font-semibold tracking-[0.2em] text-navy-300">EIGHT CONNECTED SYSTEMS</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SYSTEMS.map((s) => (
              <div key={s.title} className="rounded-xl border border-navy-700 bg-navy-850/70 p-5">
                <span className={s.status === "Live" ? "text-xs font-medium text-profit" : "text-xs font-medium text-navy-400"}>
                  {s.status === "Live" ? "● Available" : "○ Planned"}
                </span>
                <h3 className="mt-2 font-semibold text-white">{s.title}</h3>
                <p className="mt-2 text-sm text-navy-300">{s.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="relative border-t border-navy-700 py-8 text-center text-xs text-navy-400">
        EDGEFORGE is a journaling and analytics tool, not financial advice. Past performance does not predict future results.
      </footer>
    </div>
  );
}
