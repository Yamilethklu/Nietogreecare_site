"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowDown,
  CalendarCheck,
  Clock,
  Languages,
  Layers,
  Phone,
  Ruler,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { CallButton } from "@/components/site/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BUSINESS, SERVICE_CITIES } from "@/lib/constants";

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

/**
 * Hero principal: mensaje de marca, llamadas a la accion y una tarjeta de
 * medicion satelital construida con CSS (sin depender de imagenes externas).
 */
export function Hero() {
  const { t, isEs } = useLanguage();

  const trust = [
    { icon: ShieldCheck, label: t.hero.trustLicensed },
    { icon: Clock, label: t.hero.trustFast },
    { icon: Languages, label: t.hero.trustBilingual },
  ];

  const metrics = [
    { icon: Ruler, label: isEs ? "Area medida" : "Measured area", value: "4,860 ft²" },
    {
      icon: Layers,
      label: isEs ? "Material estimado" : "Estimated material",
      value: "30 yd³",
    },
    {
      icon: CalendarCheck,
      label: isEs ? "Fecha solicitada" : "Requested date",
      value: isEs ? "Por confirmar" : "To confirm",
    },
  ];

  return (
    <section id="inicio" className="relative overflow-hidden pt-14 sm:pt-20 lg:pt-24">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-500/40 to-transparent"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 top-10 size-[520px] rounded-full bg-forest-600/25 blur-[130px]"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 top-40 size-[420px] rounded-full bg-wood-700/25 blur-[130px]"
      />

      <div className="container relative grid items-center gap-14 pb-16 lg:grid-cols-[1.05fr_0.95fr] lg:pb-24">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.09 } } }}
          className="flex flex-col gap-6"
        >
          <motion.div variants={fadeUp} transition={{ duration: 0.5 }}>
            <Badge className="gap-2">
              <Sparkles className="size-3.5" />
              {t.hero.badge}
            </Badge>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            transition={{ duration: 0.6 }}
            className="font-display text-4xl font-semibold leading-[1.08] text-white sm:text-5xl lg:text-6xl"
          >
            {BUSINESS.name}
            <span className="mt-3 block ngc-gradient-text text-3xl sm:text-4xl lg:text-[2.9rem]">
              {t.hero.slogan}
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            transition={{ duration: 0.6 }}
            className="max-w-2xl text-base leading-relaxed text-ink-200/80 sm:text-lg"
          >
            {t.hero.subtitle}
          </motion.p>

          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.6 }}
            className="flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Button asChild variant="gold" size="lg">
              <Link href="/quote">{t.hero.ctaQuote}</Link>
            </Button>
            <CallButton label={t.hero.ctaCall} size="lg" />
            <Button asChild variant="ghost" size="lg">
              <Link href="/#servicios">{t.hero.ctaServices}</Link>
            </Button>
          </motion.div>

          <motion.ul
            variants={fadeUp}
            transition={{ duration: 0.6 }}
            className="flex flex-wrap gap-x-6 gap-y-3 pt-2"
          >
            {trust.map((item) => (
              <li key={item.label} className="flex items-center gap-2 text-sm text-ink-200/75">
                <item.icon className="size-4 text-gold-400" />
                {item.label}
              </li>
            ))}
          </motion.ul>
        </motion.div>
        {/* Tarjeta visual: medicion satelital */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="relative"
        >
          <div className="relative overflow-hidden rounded-3xl border border-gold-500/25 bg-ink-900/70 p-5 shadow-luxury backdrop-blur-md sm:p-6">
            <div className="ngc-grid-pattern relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-forest-950 via-ink-950 to-ink-900">
              <span
                aria-hidden="true"
                className="absolute inset-6 rounded-[28%] border-2 border-dashed border-gold-400/70 bg-gold-500/10"
              />
              <span
                aria-hidden="true"
                className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-gold-200 bg-gold-500"
              />
              <span className="absolute bottom-4 left-4 rounded-full border border-gold-500/40 bg-ink-950/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-200">
                {isEs ? "Area delimitada" : "Outlined area"}
              </span>
              <span className="absolute right-4 top-4 rounded-full border border-white/12 bg-ink-950/85 px-3 py-1 text-[11px] font-semibold text-ink-200">
                Google Maps · Satellite
              </span>
            </div>

            <ul className="mt-5 grid gap-3 sm:grid-cols-3">
              {metrics.map((metric) => (
                <li
                  key={metric.label}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                >
                  <metric.icon className="size-4 text-gold-300" />
                  <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-ink-400">
                    {metric.label}
                  </p>
                  <p className="text-sm font-semibold text-white">{metric.value}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {SERVICE_CITIES.map((city) => (
              <span
                key={city}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-ink-200/80"
              >
                {city}
              </span>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-center gap-2 text-xs text-ink-400">
            <Phone className="size-3.5 text-gold-500" />
            {BUSINESS.phoneDisplay} · {isEs ? BUSINESS.hoursEs : BUSINESS.hoursEn}
          </div>
        </motion.div>
      </div>

      <div className="container relative pb-10">
        <div className="ngc-gold-line" />
        <p className="mt-4 flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.28em] text-ink-400">
          <ArrowDown className="size-3.5 animate-float-slow text-gold-500" />
          {t.hero.scroll}
        </p>
      </div>
    </section>
  );
}