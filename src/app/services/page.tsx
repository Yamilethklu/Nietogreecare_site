import { ServicesSection } from "@/components/site/services-section";
import { PublicPage } from "@/components/site/public-page";
import { PhotoShowcase } from "@/components/site/photo-showcase";

export const metadata = { title: "Servicios | Nieto Green Care LLC" };

export default function ServicesPage() {
  return <PublicPage><PhotoShowcase heading="Nuestro trabajo en jardines de Texas" /><ServicesSection /></PublicPage>;
}
