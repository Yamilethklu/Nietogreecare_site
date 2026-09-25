import { fetchCarouselSlides } from "@/lib/gallery";

/** Fotos publicadas por el negocio; excluye vídeos para mantener una composición estable. */
export async function PhotoShowcase({ heading, start = 0 }: { heading: string; start?: number }) {
  const slides = (await fetchCarouselSlides()).filter((slide) => !/\.(?:mp4|mov|webm)(?:$|[?#])/i.test(slide.url));
  const photos = slides.length ? [...slides.slice(start), ...slides.slice(0, start)].slice(0, 3) : [{ id: "lawn", url: "/hero-bg.jpg", title: "Nieto Green Care LLC", description: null, location: null }];

  return <section className="bg-gradient-to-br from-emerald-950 via-emerald-800 to-green-600 py-12 text-white sm:py-16">
    <div className="container">
      <h2 className="mb-7 font-display text-2xl font-bold sm:text-3xl">{heading}</h2>
      <div className={`grid gap-4 ${photos.length > 1 ? "sm:grid-cols-2 lg:grid-cols-3" : ""}`}>
        {photos.map((photo) => <figure key={photo.id} className="group relative overflow-hidden rounded-2xl border border-white/30 bg-emerald-900 shadow-xl">
          <img src={photo.url} alt={photo.title || "Trabajo de jardinería de Nieto Green Care"} loading="lazy" className="h-56 w-full object-cover transition duration-500 group-hover:scale-105 sm:h-64" />
          {(photo.title || photo.location) && <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-emerald-950/90 to-transparent px-4 pb-4 pt-10 text-sm font-semibold">{photo.title || photo.location}</figcaption>}
        </figure>)}
      </div>
    </div>
  </section>;
}
