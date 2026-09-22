/**
 * Constantes oficiales de Nieto Green Care LLC.
 * Fuente unica de verdad para datos de contacto, cobertura y catalogo de servicios.
 */

const ownerSmsNumber = process.env.NEXT_PUBLIC_OWNER_SMS_NUMBER || "+17373144215";

export const BUSINESS = {
  name: "Nieto Green Care LLC",
  legalName: "Nieto Green Care LLC",
  taglineEs: "Paisajismo de lujo y cuidado profesional de areas verdes",
  taglineEn: "Luxury landscaping & professional lawn care",
  sloganEs: "Tu jardin, cuidado con excelencia.",
  sloganEn: "Your landscape, cared for with excellence.",
  phoneDisplay: "737-314-4215",
  phoneRaw: "7373144215",
  phoneE164: "+17373144215",
  ownerSmsNumber,
  // Formato nacional limpio solicitado para abrir el marcador nativo en móviles.
  telHref: "tel:7373144215",
  whatsappHref: "https://wa.me/17373144215",
  email: "nietogreencare@gmail.com",
  city: "Austin",
  state: "TX",
  country: "USA",
  serviceAreaLabel: "Austin, TX & surrounding areas",
  serviceAreaLabelEs: "Austin, TX y areas circundantes",
  hoursEs: "Lunes a Sabado · 7:00 AM - 7:00 PM",
  hoursEn: "Monday to Saturday · 7:00 AM - 7:00 PM",
  cashAppTag: "$JaimeNietoMorales",
  cashAppUrl: "https://cash.app/$JaimeNietoMorales",
  zelleName: "Nieto Green Care LLC",
  zellePhone: "737-314-4215",
} as const;

/** Abre el cliente SMS nativo con el texto de cotización solicitado. */
export function buildOwnerSmsHref(address: string): string {
  const body = `Hola Nieto Green Care LLC, solicito información sobre la cotización en ${address} para los servicios seleccionados.`;
  return `sms:${BUSINESS.ownerSmsNumber}?body=${encodeURIComponent(body)}`;
}

/** Abre WhatsApp con un mensaje breve para solicitar información o cotización. */
export function buildWhatsAppHref(message?: string): string {
  const body = message || "Hola Nieto Green Care LLC, me gustaría solicitar una cotización.";
  return `${BUSINESS.whatsappHref}?text=${encodeURIComponent(body)}`;
}

export const ADMIN_EMAILS = [
  "nietogreencare@gmail.com",
  "yamilethklunder@gmail.com",
] as const;

export const SERVICE_CITIES = [
  "Austin",
  "Hutto",
  "Round Rock",
  "Georgetown",
  "Cedar Park",
] as const;

export const NEARBY_CITIES = [
  "Pflugerville",
  "Leander",
  "Manor",
  "Lakeway",
  "Liberty Hill",
  "Taylor",
  "Buda",
  "Kyle",
] as const;

/** ZIP codes atendidos (Austin + Hutto + Round Rock + Georgetown + Cedar Park y alrededores). */
export const SERVICE_ZIP_CODES: string[] = [
  // Austin
  "78701", "78702", "78703", "78704", "78705", "78708", "78709", "78710",
  "78711", "78712", "78713", "78714", "78715", "78716", "78717", "78718",
  "78719", "78720", "78721", "78722", "78723", "78724", "78725", "78726",
  "78727", "78728", "78729", "78730", "78731", "78732", "78733", "78734",
  "78735", "78736", "78737", "78738", "78739", "78741", "78742", "78744",
  "78745", "78746", "78747", "78748", "78749", "78750", "78751", "78752",
  "78753", "78754", "78755", "78756", "78757", "78758", "78759",
  // Hutto
  "78634",
  // Round Rock
  "78664", "78665", "78681", "78682", "78683",
  // Georgetown
  "78626", "78627", "78628", "78633",
  // Cedar Park
  "78613", "78630",
  // Alrededores (Pflugerville, Leander, Manor, Liberty Hill)
  "78660", "78691", "78641", "78645", "78646", "78653", "78642",
];

/** Mapa ZIP -> ciudad principal, usado para mostrar la cobertura en el cotizador. */
export const ZIP_CITY_MAP: Record<string, string> = {
  "78634": "Hutto",
  "78664": "Round Rock",
  "78665": "Round Rock",
  "78681": "Round Rock",
  "78682": "Round Rock",
  "78683": "Round Rock",
  "78626": "Georgetown",
  "78627": "Georgetown",
  "78628": "Georgetown",
  "78633": "Georgetown",
  "78613": "Cedar Park",
  "78630": "Cedar Park",
  "78660": "Pflugerville",
  "78691": "Pflugerville",
  "78641": "Leander",
  "78645": "Leander",
  "78646": "Leander",
  "78642": "Liberty Hill",
  "78653": "Manor",
};

export const COVERAGE_RADIUS_MILES = 45;
export const DEFAULT_DEPTH_INCHES = 2;
export const MAX_CAROUSEL_SLIDES = 5;

/** Requisito del cliente: las notificaciones salen UNICAMENTE por Email y SMS (nunca WhatsApp). */
export const NOTIFICATION_CHANNELS = ["email", "sms"] as const;

export const LEAD_STATUSES = ["pending", "scheduled", "completed", "cancelled"] as const;

export type ServiceDefinition = {
  key: string;
  nameEs: string;
  nameEn: string;
  descriptionEs: string;
  descriptionEn: string;
  icon: string;
  featured?: boolean;
};

export const SERVICES: ServiceDefinition[] = [
  {
    key: "tree_trimming",
    nameEs: "Poda de arboles y arbustos",
    nameEn: "Tree & Bush Trimming",
    descriptionEs:
      "Poda tecnica, formacion de setos y retiro de ramas con equipo profesional.",
    descriptionEn:
      "Technical pruning, hedge shaping and branch haul-away with pro equipment.",
    icon: "Trees",
  },
  {
    key: "sod_installation", nameEs: "Instalación de césped", nameEn: "Sod Installation", descriptionEs: "Preparación, nivelación e instalación profesional de césped.", descriptionEn: "Professional land preparation, leveling and sod installation.", icon: "Sprout",
  },
  {
    key: "flower_beds", nameEs: "Camas de flores", nameEn: "Flower Beds", descriptionEs: "Diseño, preparación y renovación de camas de flores.", descriptionEn: "Flower bed design, preparation and renewal.", icon: "TreePine",
  },
  {
    key: "fertilizer", nameEs: "Fertilizante", nameEn: "Fertilizer", descriptionEs: "Nutrición para mantener un césped sano y vigoroso.", descriptionEn: "Nutrition to keep lawns healthy and vigorous.", icon: "Leaf",
  },
  {
    key: "gravel_rock_installation", nameEs: "Instalación de grava y roca", nameEn: "Gravel & Rock Installation", descriptionEs: "Instalación decorativa de grava, roca y piedra.", descriptionEn: "Decorative gravel, rock and stone installation.", icon: "Mountain",
  },
  {
    key: "metal_edging", nameEs: "Bordes metálicos", nameEn: "Metal Edging", descriptionEs: "Bordes metálicos definidos para camas y áreas verdes.", descriptionEn: "Defined metal edging for beds and green areas.", icon: "Scissors",
  },
  {
    key: "mulch", nameEs: "Mulch", nameEn: "Mulch", descriptionEs: "Cobertura de mulch para proteger y embellecer el jardín.", descriptionEn: "Mulch coverage to protect and enhance your landscape.", icon: "Layers",
  },
  {
    key: "yard_cleanup", nameEs: "Limpieza de patio", nameEn: "Yard Clean Up", descriptionEs: "Retiro de hojas, residuos vegetales y limpieza general.", descriptionEn: "Leaf removal, green waste hauling and general yard cleanup.", icon: "Wind",
  },
  {
    key: "top_soil", nameEs: "Tierra vegetal", nameEn: "Top Soil", descriptionEs: "Suministro e instalación de tierra vegetal de calidad.", descriptionEn: "Quality top soil supply and installation.", icon: "Sprout",
  },
  {
    key: "weekly_biweekly_lawn_service", nameEs: "Servicio de césped semanal y quincenal", nameEn: "Weekly & Biweekly Lawn Service", descriptionEs: "Mantenimiento recurrente de césped semanal o cada dos semanas.", descriptionEn: "Recurring lawn maintenance weekly or every two weeks.", icon: "CalendarCheck", featured: true,
  },
];

export const SERVICE_MAP: Record<string, ServiceDefinition> = SERVICES.reduce(
  (acc, service) => {
    acc[service.key] = service;
    return acc;
  },
  {} as Record<string, ServiceDefinition>,
);

export const PAYMENT_METHODS = [
  {
    key: "cash" as const,
    labelEs: "Efectivo",
    labelEn: "Cash",
    descriptionEs: "Pago en efectivo al finalizar el servicio.",
    descriptionEn: "Cash payment upon service completion.",
    icon: "Banknote",
  },
  {
    key: "transfer" as const,
    labelEs: "Transferencia (Cash App o Zelle)",
    labelEn: "Transfer (Cash App or Zelle)",
    descriptionEs: `Cash App ${BUSINESS.cashAppTag} o Zelle a ${BUSINESS.zelleName}.`,
    descriptionEn: `Cash App ${BUSINESS.cashAppTag} or Zelle to ${BUSINESS.zelleName}.`,
    icon: "Smartphone",
  },
  {
    key: "on_completion" as const,
    labelEs: "Pago al finalizar servicio",
    labelEn: "Pay after service completion",
    descriptionEs: "Se acuerda el metodo al terminar y confirmar el trabajo.",
    descriptionEn: "Method agreed once the work is finished and confirmed.",
    icon: "ShieldCheck",
  },
];

export const TIME_WINDOWS = [
  "07:00 - 10:00",
  "10:00 - 13:00",
  "13:00 - 16:00",
  "16:00 - 19:00",
] as const;