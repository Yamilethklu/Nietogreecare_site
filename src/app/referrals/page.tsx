import { ReferralsSection } from "@/components/site/referrals-section";
import { PublicPage } from "@/components/site/public-page";
import { PhotoShowcase } from "@/components/site/photo-showcase";

export const metadata = { title: "Referidos | Nieto Green Care LLC" };

export default function ReferralsPage() {
  return <PublicPage><ReferralsSection /><PhotoShowcase heading="Comparte el cuidado que damos a cada jardín" /></PublicPage>;
}
