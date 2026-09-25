import { ContactSection } from "@/components/site/contact-section";
import { PublicPage } from "@/components/site/public-page";
import { PhotoShowcase } from "@/components/site/photo-showcase";

export const metadata = { title: "Contacto | Nieto Green Care LLC" };

export default function ContactPage() {
  return <PublicPage><ContactSection /><PhotoShowcase heading="Jardines cuidados por nuestro equipo" start={2} /></PublicPage>;
}
