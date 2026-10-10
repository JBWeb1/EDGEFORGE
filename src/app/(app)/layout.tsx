import Link from "next/link";
import { Logo } from "@/components/logo";
import { requireUser } from "@/lib/session";
import { signOut } from "../(auth)/actions";
import { Nav } from "./nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex flex-col gap-4 border-b border-navy-700 bg-navy-950/70 p-4 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r md:p-5">
        <Link href="/dashboard" className="mb-2">
          <Logo />
        </Link>
        <Nav />
        <div className="mt-auto hidden border-t border-navy-700 pt-4 md:block">
          <p className="truncate text-sm font-medium text-white">{user.name}</p>
          <p className="truncate text-xs text-navy-400">{user.email}</p>
          <form action={signOut} className="mt-3">
            <button type="submit" className="text-xs text-navy-300 hover:text-white">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-7xl">{children}</div>
        <form action={signOut} className="mt-10 border-t border-navy-700 pt-4 text-center md:hidden">
          <span className="text-xs text-navy-400">{user.email} · </span>
          <button type="submit" className="text-xs text-navy-300 hover:text-white">Sign out</button>
        </form>
      </main>
    </div>
  );
}
