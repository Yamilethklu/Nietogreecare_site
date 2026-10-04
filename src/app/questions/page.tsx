import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "@/lib/i18n/config";
import { normalizeLocale } from "@/lib/i18n";
import { FaqSection } from "@/components/site/faq-section";
import { PublicPage } from "@/components/site/public-page";
import { PhotoShowcase } from "@/components/site/photo-showcase";

export async function generateMetadata() {
  const isEs = normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value) === "es";
  return { title: `${isEs ? "Preguntas frecuentes" : "Frequently asked questions"} | Nieto Green Care LLC` };
}

export default async function QuestionsPage() {
  const isEs = normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value) === "es";
  return <PublicPage><PhotoShowcase heading={isEs ? "Resultados de nuestro trabajo" : "The results of our work"} start={1} /><FaqSection /></PublicPage>;
}
