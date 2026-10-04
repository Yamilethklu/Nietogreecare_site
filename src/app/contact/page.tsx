import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "@/lib/i18n/config";
import { normalizeLocale } from "@/lib/i18n";
import { ContactSection } from "@/components/site/contact-section";
import { PublicPage } from "@/components/site/public-page";
import { PhotoShowcase } from "@/components/site/photo-showcase";

export async function generateMetadata() {
  const isEs = normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value) === "es";
  return { title: `${isEs ? "Contacto" : "Contact"} | Nieto Green Care LLC` };
}

export default async function ContactPage() {
  const isEs = normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value) === "es";
  return <PublicPage><ContactSection /><PhotoShowcase heading={isEs ? "Jardines cuidados por nuestro equipo" : "Yards cared for by our team"} start={2} /></PublicPage>;
}
