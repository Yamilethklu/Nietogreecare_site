"use client";

import * as React from "react";
import Link from "next/link";
import { Globe, LayoutDashboard, Menu, PhoneCall, X } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { CallButton } from "@/components/site/brand";
import { SiteLogo } from "@/components/site/brand";
import { Button } from "@/components/ui/button";
import { buildWhatsAppHref, BUSINESS } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Header elegante: logo, navegacion, selector de idioma (ES/EN) y boton "Llamar"
 * que redirige directamente a la llamada telefonica oficial.
 */
export function SiteHeader() {
  const { t, locale, toggleLocale } = useLanguage();
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  React.useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const links = [
    { href: "/#servicios", label: t.nav.services },
    { href: "/#galeria", label: t.nav.gallery },
    { href: "/#empresa", label: t.nav.about },
    { href: "/payments", label: t.nav.payments },
    { href: "/#contacto", label: t.nav.contact },
  ];

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-500",
        scrolled
          ? "border-b border-gold-500/20 bg-ink-950/90 backdrop-blur-xl"
          : "border-b border-transparent bg-gradient-to-b from-ink-950/85 to-transparent",
      )}
    >
      <div className="container flex h-20 items-center justify-between gap-4">
        <Link href="/" aria-label={BUSINESS.name} className="focus-ring rounded-xl">
          <SiteLogo size="md" />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-ink-200 transition-colors hover:bg-white/5 hover:text-gold-200"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Selector bilingue */}
          <button
            type="button"
            onClick={toggleLocale}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-white/12 bg-white/[0.03] px-3 text-xs font-semibold uppercase tracking-[0.16em] text-ink-200 transition-all hover:border-gold-500/40 hover:text-gold-200"
            aria-label={t.nav.language}
            title={t.nav.language}
          >
            <Globe className="size-4 text-gold-300" />
            <span className={cn(locale === "es" ? "text-gold-200" : "text-ink-400")}>ES</span>
            <span className="text-ink-600">/</span>
            <span className={cn(locale === "en" ? "text-gold-200" : "text-ink-400")}>EN</span>
          </button>

          <CallButton label={t.nav.call} className="hidden sm:inline-flex" />

          <Button asChild variant="gold" size="default" className="hidden xl:inline-flex">
            <a href={buildWhatsAppHref()} target="_blank" rel="noreferrer">
              {t.nav.quoteButton}
            </a>
          </Button>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex size-10 items-center justify-center rounded-full border border-white/12 text-ink-100 transition-colors hover:border-gold-500/40 lg:hidden"
            aria-label={t.nav.menu}
            aria-expanded={open}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Menu movil */}
      <div
        className={cn(
          "overflow-hidden border-t border-gold-500/10 bg-ink-950/98 backdrop-blur-xl transition-all duration-300 lg:hidden",
          open ? "max-h-[70vh]" : "max-h-0",
        )}
      >
        <div className="container flex flex-col gap-2 py-5">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 py-3 text-sm font-medium text-ink-100 transition-colors hover:bg-white/5 hover:text-gold-200"
            >
              {link.label}
            </Link>
          ))}

          <div className="ngc-gold-line my-2" />

          <CallButton label={`${t.nav.call} ${BUSINESS.phoneDisplay}`} className="w-full" />
          <Button asChild variant="gold" className="w-full">
            <a href={buildWhatsAppHref()} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
              {t.nav.quoteButton}
            </a>
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link href="/admin" onClick={() => setOpen(false)}>
              <LayoutDashboard className="size-4" />
              {t.nav.admin}
            </Link>
          </Button>

          <p className="mt-2 flex items-center gap-2 text-xs text-ink-400">
            <PhoneCall className="size-3.5 text-gold-400" />
            {BUSINESS.hoursEs}
          </p>
        </div>
      </div>
    </header>
  );
}