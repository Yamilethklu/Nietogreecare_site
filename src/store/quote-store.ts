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

export const TOTAL_STEPS = 5;
export const DRAFT_STORAGE_KEY = "ngc-quote-draft-v1";

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
  measurement: QuoteMeasurement | null;
  hasGateCode: boolean;
  gateCode: string;
  requestedDate: string | null;
  requestedTimeWindow: string;
  selectedServices: string[];
  customerName: string;
  customerPhone: string;
  customerEmail: string;
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
  measurement: null,
  hasGateCode: false,
  gateCode: "",
  requestedDate: null,
  requestedTimeWindow: "",
  selectedServices: [],
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  details: "",
  additionalNotes: "",
  paymentMethod: "on_completion",
  referenceCode: null,
  updatedAt: "",
  submitted: false,
};

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

      setAddress: (payload) => set({ ...payload, updatedAt: new Date().toISOString() }),

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
  return {
    referenceCode: state.referenceCode,
    address: state.address,
    formattedAddress: state.formattedAddress,
    zipCode: state.zipCode,
    city: state.city,
    state: state.state,
    placeId: state.placeId,
    latitude: state.latitude,
    longitude: state.longitude,
    areaSqFt: state.measurement?.areaSqFt ?? 0,
    areaSqYd: state.measurement?.areaSqYd ?? 0,
    estimatedCubicYards: state.measurement?.estimatedCubicYards ?? 0,
    depthInches: state.measurement?.depthInches ?? DEFAULT_DEPTH_INCHES,
    polygon: state.measurement?.polygon ?? [],
    polygonPath: state.measurement?.polygonPath ?? null,
    mapBounds: state.measurement?.bounds ?? null,
    hasGateCode: state.hasGateCode,
    gateCode: state.gateCode,
    requestedDate: state.requestedDate,
    requestedTimeWindow: state.requestedTimeWindow,
    selectedServices: state.selectedServices,
    customerName: state.customerName,
    customerPhone: state.customerPhone,
    customerEmail: state.customerEmail,
    details: state.details,
    additionalNotes: state.additionalNotes,
    paymentMethod: state.paymentMethod,
  };
}