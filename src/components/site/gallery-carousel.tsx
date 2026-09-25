"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageIcon, MapPin } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { SectionHeading } from "@/components/site/section-heading";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type GalleryCarouselItem = {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  location: string | null;
};

const AUTOPLAY_MS = 6500;
const VIDEO_EXTENSION = /\.(mp4|mov|webm)(?:$|[?#])/i;

function isVideoUrl(url: string) {
  return VIDEO_EXTENSION.test(url);
}

/**
 * Carrusel de trabajos reales (hasta 5 fotos o videos configurados en el panel).
 * Las fotos conservan su encuadre completo y los videos se reproducen con controles.
 */
export function GalleryCarousel({ items }: { items: GalleryCarouselItem[] }) {
  const { t, isEs } = useLanguage();
  const slides = (items ?? []).slice(0, 5);
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);

  React.useEffect(() => {
    if (paused || slides.length <= 1) return;
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % slides.length),
      AUTOPLAY_MS,
    );
    return () => window.clearInterval(timer);
  }, [paused, slides.length]);

  React.useEffect(() => {
    if (index > slides.length - 1) setIndex(0);
  }, [index, slides.length]);

  const go = (direction: 1 | -1) =>
    setIndex((current) => (current + direction + slides.length) % Math.max(1, slides.length));

  return (
    <section id="galeria" className="ngc-section scroll-mt-24">
      <div className="container flex flex-col gap-10">
        <SectionHeading
          eyebrow={t.gallery.eyebrow}
          title={t.gallery.title}
          subtitle={t.gallery.subtitle}
        />

        {slides.length === 0 ? (
          <Card className="mx-auto flex max-w-2xl flex-col items-center gap-3 p-10 text-center">
            <span className="grid size-14 place-items-center rounded-2xl border border-gold-500/30 bg-gradient-to-br from-forest-700 to-slate-50">
              <ImageIcon className="size-7 text-gold-200" />
            </span>
            <p className="text-sm leading-relaxed text-slate-700/80">{t.gallery.empty}</p>
          </Card>
        ) : (
          <div
            className="relative"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={() => setPaused(false)}
          >
            <div className="relative overflow-hidden rounded-3xl border border-gold-500/25 bg-white shadow-luxury">
              <div className="relative aspect-[16/10] sm:aspect-[16/8]">
                {slides.map((slide, slideIndex) => (
                  <div
                    key={slide.id}
                    className={cn(
                      "absolute inset-0 transition-opacity duration-700",
                      slideIndex === index ? "opacity-100" : "pointer-events-none opacity-0",
                    )}
                    aria-hidden={slideIndex !== index}
                  >
                    {isVideoUrl(slide.url) ? (
                      <video
                        controls
                        playsInline
                        preload="metadata"
                        className="absolute inset-0 size-full bg-white object-contain"
                        aria-label={slide.title ?? `${isEs ? "Video" : "Video"} ${slideIndex + 1}`}
                      >
                        <source src={slide.url} />
                        {isEs ? "Tu navegador no puede reproducir este video." : "Your browser cannot play this video."}
                      </video>
                    ) : (
                      <Image
                        src={slide.url}
                        alt={slide.title ?? `${t.gallery.slide} ${slideIndex + 1}`}
                        fill
                        sizes="(max-width: 1024px) 100vw, 1100px"
                        className="bg-white object-contain"
                        priority={slideIndex === 0}
                      />
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white via-white/35 to-transparent" />

                    {(slide.title || slide.description || slide.location) && (
                      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-5 sm:p-7">
                        {slide.location ? (
                          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-300">
                            <MapPin className="size-3.5" />
                            {slide.location}
                          </span>
                        ) : null}
                        {slide.title ? (
                          <h3 className="font-display text-xl font-semibold text-slate-900 sm:text-2xl">
                            {slide.title}
                          </h3>
                        ) : null}
                        {slide.description ? (
                          <p className="max-w-2xl text-sm text-slate-700/80">{slide.description}</p>
                        ) : null}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {slides.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => go(-1)}
                    aria-label={isEs ? "Imagen anterior" : "Previous image"}
                    className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-white text-slate-900 transition-colors hover:border-gold-500/50 hover:text-gold-200"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => go(1)}
                    aria-label={isEs ? "Imagen siguiente" : "Next image"}
                    className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-white text-slate-900 transition-colors hover:border-gold-500/50 hover:text-gold-200"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                </>
              ) : null}
            </div>

            {slides.length > 1 ? (
              <div className="mt-5 flex items-center justify-center gap-2">
                {slides.map((slide, slideIndex) => (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => setIndex(slideIndex)}
                    aria-label={`${isEs ? "Ir al elemento" : "Go to item"} ${slideIndex + 1}`}
                    aria-current={slideIndex === index}
                    className={cn(
                      "h-2 rounded-full transition-all duration-300",
                      slideIndex === index
                        ? "w-8 bg-gradient-to-r from-forest-500 to-gold-500"
                        : "w-2 bg-white/20 hover:bg-white/40",
                    )}
                  />
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}