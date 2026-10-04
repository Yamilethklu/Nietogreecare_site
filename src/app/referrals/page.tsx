import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "@/lib/i18n/config";
import { normalizeLocale } from "@/lib/i18n";
import { ReferralsSection } from "@/components/site/referrals-section";
import { PublicPage } from "@/components/site/public-page";
import { PhotoShowcase } from "@/components/site/photo-showcase";

export async function generateMetadata() {
  const isEs = normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value) === "es";
  return { title: `${isEs ? "Referidos" : "Referrals"} | Nieto Green Care LLC` };
}

export default async function ReferralsPage() {
  const isEs = normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value) === "es";
  return <PublicPage><ReferralsSection /><PhotoShowcase heading={isEs ? "Comparte el cuidado que damos a cada jardín" : "Share the care we give every yard"} /></PublicPage>;
}
