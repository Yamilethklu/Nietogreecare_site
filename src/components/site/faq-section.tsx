"use client";

import * as React from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { SectionHeading } from "@/components/site/section-heading";
import { Card } from "@/components/ui/card";

type FAQItem = {
  question: string;
  answer: string;
};

export function FaqSection() {
  const { isEs } = useLanguage();
  const [openIndex, setOpenIndex] = React.useState<number | null>(0);

  const faqs: FAQItem[] = [
    {
      question: isEs
        ? "¿Qué incluye el servicio de corte de césped?"
        : "What is included in the lawn mowing service?",
      answer: isEs
        ? "Nuestro servicio completo incluye: corte de césped profesional, recafeado de bordes (Edge), desbrozado de orillas con hilo (Line Trim) y soplado total de residuos vegetales en superficies duras."
        : "Our full service includes professional lawn mowing, line trimming around obstacles, precise hard-edge edging, and blowing off all debris from hard surfaces.",
    },
    {
      question: isEs
        ? "¿Tengo que estar en casa cuando corten el césped?"
        : "Do I need to be home when you service my lawn?",
      answer: isEs
        ? "No, no es necesario. Mientras tengamos acceso libre al patio (portones desbloqueados o código proporcionado) y las mascotas estén dentro, nosotros realizamos el trabajo."
        : "No, as long as we have gate access and pets are safely indoors, our crew can complete the service without you needing to be present.",
    },
    {
      question: isEs
        ? "¿Con qué frecuencia realizan los cortes de césped?"
        : "What service frequencies are available?",
      answer: isEs
        ? "Ofrecemos servicio Semanal (Weekly) y Quincenal (Bi-Weekly), así como servicio ocasional de una sola vez (One-time)."
        : "We offer Weekly and Bi-Weekly scheduled recurring care, as well as One-Time cleanup/mowing services.",
    },
    {
      question: isEs
        ? "¿Qué pasa si tengo mascotas en el patio trasero?"
        : "What about pets in the yard?",
      answer: isEs
        ? "Por seguridad de sus mascotas y de nuestro personal, le solicitamos asegurar a sus perros dentro de casa durante la ventana de servicio."
        : "For the safety of your pets and our crew, please ensure pets are indoors during service hours.",
    },
    {
      question: isEs
        ? "¿Cómo se calcula la tarifa de mi propiedad?"
        : "How is my property pricing calculated?",
      answer: isEs
        ? "El precio se basa en la selección de áreas (Front/Back), si la propiedad es lote de esquina, ocupación y la frecuencia elegida. Verás la tarifa fija exacta en nuestro cotizador instantáneo."
        : "Pricing is calculated based on area selections (Front, Back, or Both), corner lot status, property occupancy, and service frequency.",
    },
    {
      question: isEs
        ? "¿Qué métodos de pago aceptan?"
        : "What payment methods do you accept?",
      answer: isEs
        ? "Aceptamos efectivo, Venmo (@gxrciaa_), Cash App ($JaimeNietoMorales) y Zelle. El pago se realiza después de completar el servicio."
        : "We accept Cash, Venmo (@gxrciaa_), Cash App ($JaimeNietoMorales), and Zelle. Payment is processed upon completion of service.",
    },
  ];

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="ngc-section scroll-mt-24">
      <div className="container flex flex-col gap-10 max-w-4xl mx-auto">
        <SectionHeading
          eyebrow={isEs ? "Preguntas Frecuentes" : "Questions & Answers"}
          title={isEs ? "Respuestas claras sobre nuestro servicio" : "Frequently Asked Questions"}
          subtitle={
            isEs
              ? "Resolvemos tus dudas sobre horarios, acceso, mascotas y métodos de pago."
              : "Everything you need to know about our lawn care operations and pricing."
          }
        />

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <Card
                key={faq.question}
                className={`overflow-hidden border transition-all duration-300 ${
                  isOpen
                    ? "border-emerald-200 bg-white shadow-sm"
                    : "border-slate-200 bg-white/60 hover:border-slate-200"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  className="flex w-full items-center justify-between p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                  aria-expanded={isOpen}
                >
                  <span className="flex items-center gap-3 pr-4 font-semibold text-slate-900 sm:text-lg">
                    <HelpCircle className="size-5 text-emerald-600 shrink-0" />
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`size-5 text-emerald-600 shrink-0 transition-transform duration-300 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="border-t border-slate-200 px-5 py-4 text-sm leading-relaxed text-slate-700 bg-slate-50/20">
                    {faq.answer}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
