"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowDown,
  Clock,
  Languages,
  MapPin,
  Phone,
  Ruler,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { CallButton } from "@/components/site/brand";
import { CoverageMap } from "@/components/site/coverage-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BUSINESS, SERVICE_CITIES, SERVICE_ZIP_CODES } from "@/lib/constants";
import { usePublicAsset } from "@/lib/use-public-asset";

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

/**
 * Hero principal: fondo fotografico de cesped (hero-bg.jpg) con overlay oscuro
 * calibrado, mensaje de marca integrado dentro del contenedor sobre la imagen y
 * vista satelital real del area de cobertura.
 */
export function Hero() {
  const { t, isEs } = useLanguage();
  const heroBackground = usePublicAsset("/hero-bg.jpg");

  const trust = [
    { icon: ShieldCheck, label: t.hero.trustLicensed },
    { icon: Clock, label: t.hero.trustFast },
    { icon: Languages, label: t.hero.trustBilingual },
  ];

  const metrics = [
    {
      icon: MapPin,
      label: isEs ? "Ciudades atendidas" : "Cities served",
      value: String(SERVICE_CITIES.length),
    },
    {
      icon: Ruler,
      label: isEs ? "ZIP codes cubiertos" : "ZIP codes covered",
      value: `${SERVICE_ZIP_CODES.length}+`,
    },
    {
      icon: Clock,
      label: isEs ? "Respuesta" : "Response time",
      value: isEs ? "Mismo día" : "Same day",
    },
  ];

  return (
    <section
      id="inicio"
      className="relative isolate -mt-20 overflow-hidden pb-16 pt-32 sm:pt-36 lg:pb-24 lg:pt-40"
    >
      {/* Fondo de cesped: /public/hero-bg.jpg. Si el archivo aun no esta
          publicado se usa /public/hero-bg.svg para no dejar el hero sin textura. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/hero-bg.svg')" }}
        />
        {heroBackground === "ready" ? (
          <Image
            src="/hero-bg.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
        ) : null}
        {/* El cesped sigue visible; la legibilidad se concentra detrás del contenido. */}
        <div className="absolute inset-0 bg-ink-950/18" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950/65 via-ink-950/26 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-ink-950/38 via-transparent to-ink-950/58" />
      </div>

      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 top-24 size-[420px] rounded-full bg-gold-500/10 blur-[130px]"
      />

      <div className="container relative grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.09 } } }}
          className="relative flex flex-col gap-6 rounded-3xl bg-ink-950/22 p-5 shadow-[0_12px_48px_-24px_rgba(9,13,22,0.95)] backdrop-blur-[2px] sm:p-7 lg:-ml-7"
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
            className="font-display text-4xl font-semibold leading-[1.08] text-white drop-shadow-[0_3px_22px_rgba(9,13,22,0.9)] sm:text-5xl lg:text-6xl"
          >
            {BUSINESS.name}
            <span className="mt-3 block ngc-gradient-text text-3xl sm:text-4xl lg:text-[2.9rem]">
              {t.hero.slogan}
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            transition={{ duration: 0.6 }}
            className="max-w-2xl text-base leading-relaxed text-ink-100/90 drop-shadow-[0_1px_12px_rgba(9,13,22,0.95)] sm:text-lg"
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
              <li key={item.label} className="flex items-center gap-2 text-sm text-ink-100/85">
                <item.icon className="size-4 text-gold-400" />
                {item.label}
              </li>
            ))}
          </motion.ul>
        </motion.div>
        {/* Vista satelital real del area de cobertura */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="relative"
        >
          <CoverageMap />

          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
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