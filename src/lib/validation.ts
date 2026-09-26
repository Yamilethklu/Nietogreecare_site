/**
 * Esquemas de validacion compartidos (cliente y servidor) con Zod.
 */

import { z } from "zod";
import { SERVICE_ZIP_CODES, SERVICES } from "./constants";

const SERVICE_ZIP_SET = new Set(SERVICE_ZIP_CODES);
const SERVICE_KEY_SET = new Set(SERVICES.map((service) => service.key));
const selectedServicesSchema = z.array(z.string()).min(1, "Seleccione al menos un servicio.").refine(
  (services) => services.every((service) => SERVICE_KEY_SET.has(service)),
  "Seleccione únicamente servicios oficiales.",
);

export const zipCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{5}$/, "El codigo postal debe tener 5 digitos.")
  .refine((value) => SERVICE_ZIP_SET.has(value), {
    message:
      "Por el momento no damos servicio en ese código postal. Atendemos Liberty Hill, Cedar Park, Leander, Georgetown, Hutto, Round Rock y Jarrell.",
  });

export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[^\d]/g, ""))
  .refine(
    (digits) => digits.length === 10 || (digits.length === 11 && digits.startsWith("1")),
    { message: "Ingrese un telefono valido de 10 digitos." },
  );

export const polygonPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const boundsSchema = z.object({
  north: z.number(),
  south: z.number(),
  east: z.number(),
  west: z.number(),
});

export const measurementSchema = z.object({
  areaSqFt: z.number().min(0),
  areaSqYd: z.number().min(0),
  estimatedCubicYards: z.number().min(0),
  depthInches: z.number().min(0.5).max(24),
  perimeterFt: z.number().min(0),
  polygon: z.array(polygonPointSchema).max(40).default([]),
  polygons: z.array(z.array(polygonPointSchema).min(3).max(40)).max(8).optional(),
  polygonPath: z.string().nullable().default(null),
  bounds: boundsSchema.nullable().default(null),
  center: polygonPointSchema.nullable().default(null),
  zoom: z.number().nullable().default(null),
});

export const step1Schema = z.object({
  address: z.string().trim().min(5, "Ingrese la dirección del servicio."),
  formattedAddress: z.string().trim().default(""),
  zipCode: zipCodeSchema,
  city: z.string().trim().default(""),
  state: z.string().trim().default("TX"),
  placeId: z.string().nullable().default(null),
  latitude: z.number().nullable().default(null),
  longitude: z.number().nullable().default(null),
});

export const step2Schema = z.object({
  serviceFrequency: z.enum(["ongoing", "one_time"]),
  propertyOccupancy: z.enum(["occupied", "vacant"]),
});

export const step3Schema = z.object({
  mowFrequency: z.enum(["weekly", "bi_weekly"]),
});

export const step4Schema = z.object({
  areaSelection: z.enum(["front_back", "front_only", "back_only"]),
  isCornerLot: z.boolean().default(false),
});

export const step5Schema = z.object({
  requestedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Seleccione la fecha de servicio."),
});

export const measurementStepSchema = z.object({ measurement: measurementSchema }).refine((value) => value.measurement.polygon.length >= 3 && value.measurement.areaSqFt > 0, { message: "Marque el césped en el satélite.", path: ["measurement"] });

export const step6Schema = z.object({});

export const step7Schema = z.object({
  firstName: z.string().trim().min(1, "Ingrese su nombre."),
  lastName: z.string().trim().min(1, "Ingrese sus apellidos."),
  customerPhone: phoneSchema,
  customerEmail: z.string().trim().email("Ingrese un correo válido."),
  hasGateCode: z.boolean(),
  gateCode: z.string(),
}).refine((data) => !data.hasGateCode || data.gateCode.trim().length > 0, {
  message: "Indique el código del candado o acceso.", path: ["gateCode"],
});

/** Payload completo enviado a POST /api/leads */
export const leadSubmissionSchema = z
  .object({
    referenceCode: z.string().trim().min(4).max(40),
    quotedPrice: z.number().positive(),
    address: z.string().trim().min(5),
    formattedAddress: z.string().trim().default(""),
    zipCode: zipCodeSchema,
    city: z.string().trim().default(""),
    state: z.string().trim().default("TX"),
    placeId: z.string().nullable().default(null),
    latitude: z.number().nullable().default(null),
    longitude: z.number().nullable().default(null),
    areaSqFt: z.number().positive(),
    areaSqYd: z.number().min(0).default(0),
    estimatedCubicYards: z.number().min(0).default(0),
    depthInches: z.number().min(0).max(24).default(2),
    polygon: z.array(polygonPointSchema).max(40).default([]),
  polygons: z.array(z.array(polygonPointSchema).min(3).max(40)).max(8).optional(),
    polygonPath: z.string().nullable().default(null),
    snapshotUrl: z.string().nullable().default(null),
    mapBounds: boundsSchema.nullable().default(null),
    hasGateCode: z.boolean().default(false),
    gateCode: z.string().trim().max(80).default(""),
    requestedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    requestedTimeWindow: z.string().trim().default(""),
    selectedServices: selectedServicesSchema,
    customerName: z.string().trim().min(2),
    customerPhone: phoneSchema,
    customerEmail: z.string().trim().email(),
    details: z.string().trim().max(2000).default(""),
    additionalNotes: z.string().trim().max(2000).default(""),
    paymentMethod: z.enum(["cash", "cash_app", "venmo", "zelle"]),
    cashLocation: z.string().trim().max(300).default(""),
    quoteOptions: z.object({
      serviceFrequency: z.enum(["ongoing", "one_time"]),
      mowFrequency: z.enum(["weekly", "bi_weekly"]),
      areaSelection: z.enum(["front_back", "front_only", "back_only"]),
      isCornerLot: z.boolean(),
      propertyOccupancy: z.enum(["occupied", "vacant"]),
    }),
  })
  .refine((data) => data.paymentMethod !== "cash" || data.cashLocation.length > 2, { message: "Indique dónde dejará el efectivo.", path: ["cashLocation"] })
  .refine((data) => data.polygon.length >= 3, { message: "Marque el área del césped.", path: ["polygon"] })
  .refine((data) => !data.hasGateCode || data.gateCode.length > 0, {
    message: "Indique la contrasena del porton.",
    path: ["gateCode"],
  });

export type LeadSubmission = z.infer<typeof leadSubmissionSchema>;

export const leadStatusSchema = z.enum(["pending", "scheduled", "completed", "cancelled"]);

export const leadUpdateSchema = z.object({
  status: leadStatusSchema.optional(),
  final_price: z.number().min(0).nullable().optional(),
  admin_notes: z.string().trim().max(4000).nullable().optional(),
  scheduled_for: z.string().nullable().optional(),
  assigned_crew: z.string().trim().max(120).nullable().optional(),
  requested_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export const galleryItemSchema = z.object({
  title: z.string().trim().max(160).default(""),
  description: z.string().trim().max(1000).default(""),
  storage_path: z.string().trim().nullable().default(null),
  public_url: z.string().url(),
  service_key: z.string().trim().nullable().default(null),
  location: z.string().trim().max(160).nullable().default(null),
  taken_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  is_carousel: z.boolean().default(false),
  carousel_order: z.number().int().min(0).max(49).nullable().default(null),
  is_published: z.boolean().default(true),
  is_featured: z.boolean().default(false),
});

export const galleryUpdateSchema = galleryItemSchema.partial();

export const pricingRuleSchema = z.object({
  name: z.string().trim().min(2).max(160),
  service_key: z.string().trim().nullable().default(null),
  min_sq_ft: z.number().min(0),
  max_sq_ft: z.number().min(0).nullable().default(null),
  price: z.number().min(0),
  price_per_sq_ft: z.number().min(0).nullable().default(null),
  price_per_cubic_yard: z.number().min(0).nullable().default(null),
  default_depth_inches: z.number().min(0.5).max(24).default(2),
  capacity_per_day: z.number().int().min(1).max(24).default(4),
  duration_minutes: z.number().int().min(15).max(600).default(90),
  is_active: z.boolean().default(true),
  notes: z.string().trim().max(1000).nullable().default(null),
});

export const contactMessageSchema = z.object({
  name: z.string().trim().min(2, "Ingrese su nombre."),
  phone: z.string().trim().min(7, "Ingrese un telefono de contacto."),
  email: z.string().trim().email("Correo invalido.").optional().or(z.literal("")),
  message: z.string().trim().min(5, "Escriba su mensaje.").max(2000),
  preferredChannel: z.enum(["email", "sms"]).default("sms"),
});

export type ContactMessage = z.infer<typeof contactMessageSchema>;

/** Convierte los errores de Zod en un mapa campo -> mensaje. */
export function formatZodErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}
