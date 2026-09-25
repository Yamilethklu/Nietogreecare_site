import { FaqSection } from "@/components/site/faq-section";
import { PublicPage } from "@/components/site/public-page";
import { PhotoShowcase } from "@/components/site/photo-showcase";

export const metadata = { title: "Preguntas frecuentes | Nieto Green Care LLC" };

export default function QuestionsPage() {
  return <PublicPage><PhotoShowcase heading="Resultados de nuestro trabajo" start={1} /><FaqSection /></PublicPage>;
}
