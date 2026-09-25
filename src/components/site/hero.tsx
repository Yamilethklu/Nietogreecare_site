"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
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
import { Step1Address } from "@/components/quote/step-1-address";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { buildSmsHref, BUSINESS, SERVICE_CITIES, SERVICE_ZIP_CODES, ZIP_CITY_MAP } from "@/lib/constants";
import { usePublicAsset } from "@/lib/use-public-asset";
import { useQuoteStore } from "@/store/quote-store";

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
  const router = useRouter();
  const { t, isEs } = useLanguage();
  const heroBackground = usePublicAsset("/hero-bg.jpg");

  const address = useQuoteStore((state) => state.address);
  const zipCode = useQuoteStore((state) => state.zipCode);
  const setAddress = useQuoteStore((state) => state.setAddress);
  const setStep = useQuoteStore((state) => state.setStep);

  const [heroZip, setHeroZip] = React.useState(zipCode ?? "");
  const [heroError, setHeroError] = React.useState("");

  React.useEffect(() => {
    if (zipCode) setHeroZip(zipCode);
  }, [zipCode]);

  const handleHeroSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || address.trim().length < 4) {
      setHeroError(isEs ? "Ingrese su dirección para cotizar." : "Please enter your address.");
      return;
    }
    const cleanZip = heroZip.replace(/\D/g, "").slice(0, 5);
    setAddress({
      zipCode: cleanZip,
      city: ZIP_CITY_MAP[cleanZip] ?? "",
    });
    setStep(1);
    router.push("/quote");
  };

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
      icon: Phone,
      label: isEs ? "Llámenos" : "Call us",
      value: BUSINESS.phoneDisplay,
    },
    {
      icon: Clock,
      label: isEs ? "Horario" : "Hours",
      value: isEs ? "Lun–Sáb · 7 AM–7 PM" : "Mon–Sat · 7 AM–7 PM",
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
          className="relative flex flex-col gap-6 rounded-3xl border border-white/15 bg-emerald-950/80 p-5 shadow-[0_12px_48px_-24px_rgba(9,13,22,0.95)] backdrop-blur-md sm:p-7 lg:-ml-7"
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
            className="max-w-2xl text-base leading-relaxed text-white drop-shadow-[0_1px_12px_rgba(9,13,22,0.95)] sm:text-lg"
          >
            {t.hero.subtitle}
          </motion.p>

          {/* Formulario Directo en el Hero */}
          <motion.form
            variants={fadeUp}
            transition={{ duration: 0.6 }}
            onSubmit={handleHeroSubmit}
            className="mt-1 flex flex-col gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/60 p-4 backdrop-blur-md"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
              {isEs ? "Obtenga su cotización instantánea" : "Get your instant quote"}
            </p>

            <div className="grid gap-3 sm:grid-cols-[1.6fr_1fr]">
              <div>
                <Step1Address error={heroError} isEs={isEs} />
              </div>
              <div>
                <Label htmlFor="hero-zip">{isEs ? "Zip Code *" : "Zip Code *"}</Label>
                <Input
                  id="hero-zip"
                  value={heroZip}
                  onChange={(e) => setHeroZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                  placeholder="78701"
                  maxLength={5}
                  className="mt-2"
                />
              </div>
            </div>

            {heroError && (
              <p className="text-xs text-rose-400 font-medium">{heroError}</p>
            )}

            <Button
              type="submit"
              variant="gold"
              size="lg"
              className="mt-1 w-full text-base font-bold tracking-wide shadow-lg hover:scale-[1.01] transition-transform"
            >
              FREE PRICE QUOTE
              <ArrowRight className="ml-2 size-5" />
            </Button>
          </motion.form>

          <motion.ul
            variants={fadeUp}
            transition={{ duration: 0.6 }}
            className="flex flex-wrap gap-x-6 gap-y-3 pt-2"
          >
            {trust.map((item) => (
              <li key={item.label} className="flex items-center gap-2 text-sm text-white">
                <item.icon className="size-4 text-amber-300" />
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

          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {metrics.map((metric) => (
              <li
                key={metric.label}
                className="rounded-2xl border border-white/30 bg-black/70 p-4 backdrop-blur-md"
              >
                <metric.icon className="size-4 text-amber-300" />
                <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-white">
                  {metric.label}
                </p>
                <p className="mt-1 text-sm font-semibold text-amber-300">{metric.value}</p>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/30 bg-black/70 p-3 backdrop-blur-md">
            {SERVICE_CITIES.map((city) => (
              <a
                key={city}
                href={buildSmsHref()}
                className="rounded-full border border-amber-300/55 bg-black/50 px-3 py-1 text-xs font-semibold text-white transition hover:border-amber-300 hover:text-amber-300"
              >
                {city}
              </a>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-white/30 bg-black/70 px-4 py-3 text-sm font-semibold text-white backdrop-blur-md">
            <Phone className="size-4 text-amber-300" />
            <a href={BUSINESS.telHref} className="text-amber-300 hover:text-amber-200">
              {BUSINESS.phoneDisplay}
            </a>
            <span className="text-amber-300">·</span>
            <span>{isEs ? BUSINESS.hoursEs : BUSINESS.hoursEn}</span>
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