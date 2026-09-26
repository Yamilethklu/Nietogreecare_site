import { SiteHeader } from "@/components/site/header";

export function PublicPage({ children }: { children: React.ReactNode }) {
  return <>
    <SiteHeader />
    <main className="min-h-[calc(100dvh-5rem)] bg-gradient-to-b from-emerald-50 via-lime-50 to-emerald-100 text-slate-900">{children}</main>
  </>;
}
