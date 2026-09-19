/**
 * Constantes oficiales de Nieto Green Care LLC.
 * Fuente unica de verdad para datos de contacto, cobertura y catalogo de servicios.
 */

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
  telHref: "tel:7373144215",
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
  basePrice: number;
  featured?: boolean;
};

export const SERVICES: ServiceDefinition[] = [
  {
    key: "mowing",
    nameEs: "Corte y orillado de cesped",
    nameEn: "Lawn mowing & edging",
    descriptionEs:
      "Corte preciso, orillado, desbroce y soplado de residuos para una linea impecable.",
    descriptionEn:
      "Precision mowing, edging, trimming and blowing for a flawless finish.",
    icon: "Scissors",
    basePrice: 45,
    featured: true,
  },
  {
    key: "landscape_design",
    nameEs: "Diseno de paisajismo",
    nameEn: "Landscape design",
    descriptionEs:
      "Proyectos a medida: camas de jardin, iluminacion, grava decorativa y especies nativas de Texas.",
    descriptionEn:
      "Bespoke projects: garden beds, lighting, decorative gravel and Texas native plants.",
    icon: "TreePine",
    basePrice: 250,
    featured: true,
  },
  {
    key: "sod_installation",
    nameEs: "Instalacion de cesped (sod)",
    nameEn: "Sod installation",
    descriptionEs:
      "Preparacion del terreno, nivelacion y colocacion de sod fresco con garantia de arraigo.",
    descriptionEn:
      "Land prep, leveling and fresh sod installation with establishment warranty.",
    icon: "Sprout",
    basePrice: 320,
    featured: true,
  },
  {
    key: "fertilization",
    nameEs: "Fertilizacion y control de maleza",
    nameEn: "Fertilization & weed control",
    descriptionEs:
      "Programas de nutricion temporada por temporada y control integral de maleza.",
    descriptionEn: "Season-by-season nutrition programs and complete weed control.",
    icon: "Leaf",
    basePrice: 85,
    featured: true,
  },
  {
    key: "mulching",
    nameEs: "Mulch y cuidado de camas",
    nameEn: "Mulching & bed care",
    descriptionEs:
      "Mulch premium, bordes definidos y limpieza profunda de camas de jardin.",
    descriptionEn: "Premium mulch, crisp bed edging and deep garden bed cleanup.",
    icon: "Layers",
    basePrice: 150,
  },
  {
    key: "tree_trimming",
    nameEs: "Poda de arboles y arbustos",
    nameEn: "Tree & shrub trimming",
    descriptionEs:
      "Poda tecnica, formacion de setos y retiro de ramas con equipo profesional.",
    descriptionEn:
      "Technical pruning, hedge shaping and branch haul-away with pro equipment.",
    icon: "Trees",
    basePrice: 180,
  },
  {
    key: "yard_cleanup",
    nameEs: "Limpieza de patio y hojas",
    nameEn: "Yard & leaf cleanup",
    descriptionEs:
      "Retiro de hojas, escombro vegetal, maleza alta y basura del area verde.",
    descriptionEn:
      "Leaf removal, green waste hauling, tall weed clearing and yard debris pickup.",
    icon: "Wind",
    basePrice: 120,
  },
  {
    key: "irrigation",
    nameEs: "Riego e irrigacion",
    nameEn: "Irrigation & sprinkler care",
    descriptionEs:
      "Revision de aspersores, ajuste de cobertura, fugas y programacion de riego.",
    descriptionEn:
      "Sprinkler inspection, coverage tuning, leak repair and schedule programming.",
    icon: "Droplets",
    basePrice: 110,
  },
  {
    key: "rock_gravel",
    nameEs: "Roca y grava decorativa",
    nameEn: "Rock & decorative gravel",
    descriptionEs:
      "Instalacion de grava, piedra de rio y mantos de roca para acabados de lujo.",
    descriptionEn: "Gravel, river rock and rock beds installed for a high-end finish.",
    icon: "Mountain",
    basePrice: 260,
  },
  {
    key: "seasonal_program",
    nameEs: "Programa mensual (mantenimiento)",
    nameEn: "Monthly maintenance program",
    descriptionEs:
      "Visitas recurrentes con precio preferente, recordatorios automaticos y prioridad de agenda.",
    descriptionEn:
      "Recurring visits with preferred pricing, automatic reminders and scheduling priority.",
    icon: "CalendarCheck",
    basePrice: 75,
    featured: true,
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