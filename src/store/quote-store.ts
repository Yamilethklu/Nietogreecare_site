"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { DEFAULT_DEPTH_INCHES } from "@/lib/constants";
import {
  cubicYardsFromArea,
  encodePolyline,
  getBounds,
  getCentroid,
  polygonPerimeterFeet,
  squareFeetToSquareYards,
} from "@/lib/geo";
import type { PaymentMethod, PolygonPoint, QuoteMeasurement } from "@/lib/types";
import { buildReferenceCode } from "@/lib/utils";

/**
 * Estado global del cotizador paso a paso.
 *
 * Requisito critico: la informacion NO se pierde al navegar hacia adelante y hacia
 * atras. Zustand + persist (localStorage) conserva cada campo, la medicion satelital,
 * el recorte del area y los pasos completados, incluso si el cliente cierra el navegador.
 */

export const TOTAL_STEPS = 7;
export const DRAFT_STORAGE_KEY = "ngc-quote-draft-v2";

export type ServiceFrequency = "ongoing" | "one_time";
export type PropertyOccupancy = "occupied" | "vacant";
export type MowFrequency = "weekly" | "bi_weekly";
export type AreaSelection = "front_back" | "front_only" | "back_only";

export type QuoteStateFields = {
  step: number;
  completedSteps: number[];
  address: string;
  formattedAddress: string;
  zipCode: string;
  city: string;
  state: string;
  placeId: string | null;
  latitude: number | null;
  longitude: number | null;

  // Paso 2: Frecuencia y Ocupacion
  serviceFrequency: ServiceFrequency;
  propertyOccupancy: PropertyOccupancy;

  // Paso 3: Frecuencia de Corte
  mowFrequency: MowFrequency;

  // Paso 4: Area a Cortar & Lote de esquina
  areaSelection: AreaSelection;
  isCornerLot: boolean;

  // Paso 5: Calendario de Corte
  requestedDate: string | null;
  requestedTimeWindow: string;

  // Paso 7: Account & Yard Details
  firstName: string;
  lastName: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  isCellphone: boolean;
  isGrassOver6: boolean;
  isGrassOver12: boolean;
  hasCommunityGate: boolean;
  hasBackyardGate: boolean;
  hasPetsInBackyard: boolean;

  // Compatibilidad y campos generales
  measurement: QuoteMeasurement | null;
  hasGateCode: boolean;
  gateCode: string;
  selectedServices: string[];
  details: string;
  additionalNotes: string;
  paymentMethod: PaymentMethod;
  referenceCode: string | null;
  updatedAt: string;
  submitted: boolean;
};

export type QuoteStore = QuoteStateFields & {
  setStep: (step: number) => void;
  goNext: () => void;
  goBack: () => void;
  completeStep: (step: number) => void;
  setAddress: (payload: Partial<QuoteStateFields>) => void;
  setLawnOptions: (payload: Partial<QuoteStateFields>) => void;
  setAccountDetails: (payload: Partial<QuoteStateFields>) => void;
  setMeasurement: (measurement: QuoteMeasurement, depthInches?: number) => void;
  updateDepth: (depthInches: number) => void;
  clearMeasurement: () => void;
  toggleService: (key: string) => void;
  setServices: (keys: string[]) => void;
  setGate: (hasGateCode: boolean, gateCode?: string) => void;
  setSchedule: (requestedDate: string, requestedTimeWindow?: string) => void;
  setPersonal: (payload: Partial<QuoteStateFields>) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  ensureReferenceCode: () => string;
  reset: () => void;
  markSubmitted: () => void;
  hasDraftData: () => boolean;
};

const initialFields: QuoteStateFields = {
  step: 1,
  completedSteps: [],
  address: "",
  formattedAddress: "",
  zipCode: "",
  city: "",
  state: "TX",
  placeId: null,
  latitude: null,
  longitude: null,

  serviceFrequency: "ongoing",
  propertyOccupancy: "occupied",
  mowFrequency: "bi_weekly",
  areaSelection: "front_back",
  isCornerLot: false,

  requestedDate: null,
  requestedTimeWindow: "08:00 - 18:00",

  firstName: "",
  lastName: "",
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  isCellphone: true,
  isGrassOver6: false,
  isGrassOver12: false,
  hasCommunityGate: false,
  hasBackyardGate: false,
  hasPetsInBackyard: false,

  measurement: null,
  hasGateCode: false,
  gateCode: "",
  selectedServices: ["weekly_biweekly_lawn_service"],
  details: "",
  additionalNotes: "",
  paymentMethod: "on_completion",
  referenceCode: null,
  updatedAt: "",
  submitted: false,
};

export function calculateLawnQuote(fields: {
  serviceFrequency: ServiceFrequency;
  mowFrequency: MowFrequency;
  areaSelection: AreaSelection;
  isCornerLot: boolean;
}) {
  let basePrice = 42;
  if (fields.mowFrequency === "weekly") {
    basePrice = fields.areaSelection === "front_back" ? 38 : 30;
  } else {
    basePrice = fields.areaSelection === "front_back" ? 42 : 34;
  }

  if (fields.isCornerLot) {
    basePrice += 5;
  }

  if (fields.serviceFrequency === "one_time") {
    basePrice += 20;
  }

  const frequencyText = fields.mowFrequency === "weekly" ? "weekly" : "bi-weekly";
  const rateText = `$${basePrice} ${frequencyText} + tax`;
  const perCutText = `$${basePrice}/corte`;

  return {
    price: basePrice,
    frequencyText,
    rateText,
    perCutText,
  };
}

/** Recalcula la medicion completa (area, yardas, perimetro, bounds, polyline). */
export function buildMeasurement(
  polygon: PolygonPoint[],
  areaSqFt: number,
  depthInches: number = DEFAULT_DEPTH_INCHES,
  zoom?: number | null,
): QuoteMeasurement {
  const bounds = getBounds(polygon);
  const center = getCentroid(polygon);
  return {
    areaSqFt: Math.round(areaSqFt * 100) / 100,
    areaSqYd: Math.round(squareFeetToSquareYards(areaSqFt) * 100) / 100,
    estimatedCubicYards: Math.round(cubicYardsFromArea(areaSqFt, depthInches) * 100) / 100,
    depthInches,
    perimeterFt: Math.round(polygonPerimeterFeet(polygon) * 100) / 100,
    polygon,
    polygonPath: polygon.length > 2 ? encodePolyline(polygon) : null,
    bounds,
    center,
    zoom: zoom ?? null,
  };
}

const dummyStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const safeLocalStorage = () => {
  if (typeof window === "undefined") return dummyStorage;
  try {
    return window.localStorage ?? dummyStorage;
  } catch {
    return dummyStorage;
  }
};

export const useQuoteStore = create<QuoteStore>()(
  persist(
    (set, get) => ({
      ...initialFields,

      setStep: (step) => {
        const safe = Math.min(TOTAL_STEPS, Math.max(1, step));
        set({ step: safe, updatedAt: new Date().toISOString() });
      },

      goNext: () => {
        const { step, completedSteps = [] } = get();
        const next = Math.min(TOTAL_STEPS, step + 1);
        const completed = completedSteps.includes(step)
          ? completedSteps
          : [...completedSteps, step];
        set({ step: next, completedSteps: completed, updatedAt: new Date().toISOString() });
      },

      goBack: () => {
        const { step } = get();
        set({ step: Math.max(1, step - 1), updatedAt: new Date().toISOString() });
      },

      completeStep: (step) => {
        const { completedSteps = [] } = get();
        if (completedSteps.includes(step)) return;
        set({ completedSteps: [...completedSteps, step], updatedAt: new Date().toISOString() });
      },

      setAddress: (payload) => set((state) => ({ ...state, ...payload, updatedAt: new Date().toISOString() })),

      setLawnOptions: (payload) => set((state) => ({ ...state, ...payload, updatedAt: new Date().toISOString() })),

      setAccountDetails: (payload) =>
        set((state) => {
          const updated = { ...state, ...payload };
          const fullName = `${updated.firstName ?? ""} ${updated.lastName ?? ""}`.trim();
          return {
            ...updated,
            customerName: fullName || updated.customerName,
            updatedAt: new Date().toISOString(),
          };
        }),

      setMeasurement: (measurement, depthInches) => {
        if (depthInches === undefined) {
          set({ measurement, updatedAt: new Date().toISOString() });
          return;
        }
        set({
          measurement: {
            ...measurement,
            depthInches,
            estimatedCubicYards:
              Math.round(cubicYardsFromArea(measurement.areaSqFt, depthInches) * 100) / 100,
          },
          updatedAt: new Date().toISOString(),
        });
      },

      updateDepth: (depthInches) => {
        const { measurement } = get();
        if (!measurement) return;
        set({
          measurement: {
            ...measurement,
            depthInches,
            estimatedCubicYards:
              Math.round(cubicYardsFromArea(measurement.areaSqFt, depthInches) * 100) / 100,
          },
          updatedAt: new Date().toISOString(),
        });
      },

      clearMeasurement: () => set({ measurement: null, updatedAt: new Date().toISOString() }),

      toggleService: (key) => {
        const selectedServices = get().selectedServices ?? [];
        const next = selectedServices.includes(key)
          ? selectedServices.filter((item) => item !== key)
          : [...selectedServices, key];
        set({ selectedServices: next, updatedAt: new Date().toISOString() });
      },

      setServices: (keys) => set({ selectedServices: keys ?? [], updatedAt: new Date().toISOString() }),

      setGate: (hasGateCode, gateCode = "") =>
        set({
          hasGateCode,
          gateCode: hasGateCode ? gateCode : "",
          updatedAt: new Date().toISOString(),
        }),

      setSchedule: (requestedDate, requestedTimeWindow) =>
        set({
          requestedDate,
          ...(requestedTimeWindow !== undefined ? { requestedTimeWindow } : {}),
          updatedAt: new Date().toISOString(),
        }),

      setPersonal: (payload) => set({ ...payload, updatedAt: new Date().toISOString() }),

      setPaymentMethod: (method) =>
        set({ paymentMethod: method, updatedAt: new Date().toISOString() }),

      ensureReferenceCode: () => {
        const existing = get().referenceCode;
        if (existing) return existing;
        const code = buildReferenceCode();
        set({ referenceCode: code, updatedAt: new Date().toISOString() });
        return code;
      },

      reset: () => set({ ...initialFields, updatedAt: new Date().toISOString() }),

      markSubmitted: () => set({ submitted: true, updatedAt: new Date().toISOString() }),

      hasDraftData: () => {
        const state = get();
        return Boolean(
          state.address || state.zipCode || state.measurement || (state.selectedServices ?? []).length,
        );
      },
    }),
    {
      name: DRAFT_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(safeLocalStorage),
      skipHydration: true,
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<QuoteStateFields>) || {};
        return {
          ...currentState,
          ...persisted,
          step: typeof persisted.step === "number" && persisted.step >= 1 && persisted.step <= TOTAL_STEPS ? persisted.step : 1,
          completedSteps: Array.isArray(persisted.completedSteps) ? persisted.completedSteps : [],
          selectedServices: Array.isArray(persisted.selectedServices) ? persisted.selectedServices : [],
          address: typeof persisted.address === "string" ? persisted.address : "",
          formattedAddress: typeof persisted.formattedAddress === "string" ? persisted.formattedAddress : "",
          zipCode: typeof persisted.zipCode === "string" ? persisted.zipCode : "",
          city: typeof persisted.city === "string" ? persisted.city : "",
          state: typeof persisted.state === "string" ? persisted.state : "TX",
          customerName: typeof persisted.customerName === "string" ? persisted.customerName : "",
          customerPhone: typeof persisted.customerPhone === "string" ? persisted.customerPhone : "",
          customerEmail: typeof persisted.customerEmail === "string" ? persisted.customerEmail : "",
          details: typeof persisted.details === "string" ? persisted.details : "",
          additionalNotes: typeof persisted.additionalNotes === "string" ? persisted.additionalNotes : "",
          gateCode: typeof persisted.gateCode === "string" ? persisted.gateCode : "",
          hasGateCode: Boolean(persisted.hasGateCode),
          submitted: Boolean(persisted.submitted),
        };
      },
    },
  ),
);

/** Campos que se envian a la API al confirmar la solicitud. */
export function pickSubmissionFields(state: QuoteStore) {
  const lawnQuote = calculateLawnQuote(state);
  const fullName = `${state.firstName} ${state.lastName}`.trim() || state.customerName;

  const surveyDetails = [
    `Servicio: ${lawnQuote.rateText}`,
    `Frecuencia: ${state.serviceFrequency === "ongoing" ? "Ongoing" : "One-time"}`,
    `Ocupación: ${state.propertyOccupancy === "occupied" ? "Occupied" : "Vacant"}`,
    `Corte: ${state.mowFrequency === "weekly" ? "Weekly" : "Bi-Weekly"}`,
    `Área: ${state.areaSelection === "front_back" ? "Front & Back" : state.areaSelection === "front_only" ? "Front Only" : "Back Only"}`,
    `Lote de esquina: ${state.isCornerLot ? "Sí" : "No"}`,
    `Es Celular: ${state.isCellphone ? "Sí" : "No"}`,
    `Gras > 6": ${state.isGrassOver6 ? "Sí" : "No"}`,
    `Gras > 12": ${state.isGrassOver12 ? "Sí" : "No"}`,
    `Portón comunidad: ${state.hasCommunityGate ? "Sí" : "No"}`,
    `Portón patio trasero: ${state.hasBackyardGate ? "Sí" : "No"}`,
    `Mascotas patio trasero: ${state.hasPetsInBackyard ? "Sí" : "No"}`,
  ].join(" | ");

  return {
    referenceCode: state.referenceCode,
    address: state.address,
    formattedAddress: state.formattedAddress || state.address,
    zipCode: state.zipCode,
    city: state.city,
    state: state.state || "TX",
    placeId: state.placeId,
    latitude: state.latitude,
    longitude: state.longitude,
    areaSqFt: 0,
    areaSqYd: 0,
    estimatedCubicYards: 0,
    depthInches: 2,
    polygon: [],
    polygonPath: null,
    snapshotUrl: null,
    mapBounds: null,
    hasGateCode: state.hasBackyardGate || state.hasCommunityGate,
    gateCode: state.hasCommunityGate ? "Community Gate" : "",
    requestedDate: state.requestedDate || new Date().toISOString().split("T")[0],
    requestedTimeWindow: state.requestedTimeWindow || "08:00 - 18:00",
    selectedServices: state.selectedServices.length ? state.selectedServices : ["weekly_biweekly_lawn_service"],
    customerName: fullName,
    customerPhone: state.customerPhone,
    customerEmail: state.customerEmail,
    details: surveyDetails,
    additionalNotes: state.additionalNotes || "",
    paymentMethod: state.paymentMethod || "on_completion",
  };
}