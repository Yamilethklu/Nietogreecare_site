import { SiteHeader } from "@/components/site/header";

export function PublicPage({ children }: { children: React.ReactNode }) {
  return <>
    <SiteHeader />
    <main className="min-h-[calc(100dvh-5rem)] bg-white text-slate-900">{children}</main>
  </>;
}
