import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "@/lib/i18n/config";
import { normalizeLocale } from "@/lib/i18n";
import { ServicesSection } from "@/components/site/services-section";
import { PublicPage } from "@/components/site/public-page";
import { PhotoShowcase } from "@/components/site/photo-showcase";

export async function generateMetadata() {
  const isEs = normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value) === "es";
  return { title: `${isEs ? "Servicios" : "Services"} | Nieto Green Care LLC` };
}

export default async function ServicesPage() {
  const isEs = normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value) === "es";
  return <PublicPage><PhotoShowcase heading={isEs ? "Nuestro trabajo en jardines de Texas" : "Our work in Texas yards"} /><ServicesSection /></PublicPage>;
}
