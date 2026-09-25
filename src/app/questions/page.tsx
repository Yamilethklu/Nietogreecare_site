import { FaqSection } from "@/components/site/faq-section";
import { PublicPage } from "@/components/site/public-page";

export const metadata = { title: "Preguntas frecuentes | Nieto Green Care LLC" };

export default function QuestionsPage() {
  return <PublicPage><FaqSection /></PublicPage>;
}
