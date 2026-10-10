import Link from "next/link";
import { LogoMark } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[48rem] -translate-x-1/2 rounded-full bg-brand-violet/15 blur-3xl" />
      <div className="relative w-full max-w-sm">
        <Link href="/" className="mb-8 flex flex-col items-center gap-3">
          <LogoMark className="h-14 w-14" glow />
          <span className="font-semibold tracking-[0.2em] text-white">EDGEFORGE</span>
        </Link>
        {children}
      </div>
    </main>
  );
}
