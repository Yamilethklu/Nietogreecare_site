/**
 * Tipos compartidos entre el cotizador, la API y el panel de administracion.
 */

export type LeadStatus = "pending" | "scheduled" | "completed" | "cancelled";
export type PaymentMethod = "cash" | "transfer" | "on_completion";

export type PolygonPoint = { lat: number; lng: number };

export type MapBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export type QuoteMeasurement = {
  areaSqFt: number;
  areaSqYd: number;
  estimatedCubicYards: number;
  depthInches: number;
  perimeterFt: number;
  polygon: PolygonPoint[];
  polygonPath: string | null;
  bounds: MapBounds | null;
  center: PolygonPoint | null;
  zoom: number | null;
};

/** Borrador guardado en el navegador: nunca se pierde al navegar entre pasos. */
export type QuoteDraft = {
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
  details: string;
  additionalNotes: string;
  paymentMethod: PaymentMethod;
  referenceCode: string | null;
  updatedAt: string;
};

export interface Lead {
  id: string;
  reference_code: string;
  address: string;
  formatted_address: string | null;
  zip_code: string;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  place_id: string | null;
  area_sq_ft: number | string;
  area_sq_yd: number | string;
  estimated_cubic_yards: number | string;
  depth_inches: number | string;
  polygon: PolygonPoint[] | null;
  polygon_path: string | null;
  snapshot_url: string | null;
  map_bounds: MapBounds | null;
  has_gate_code: boolean;
  gate_code: string | null;
  requested_date: string | null;
  requested_time_window: string | null;
  selected_services: string[] | null;
  service_count: number;
  estimated_price: number | string | null;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  details: string | null;
  additional_notes: string | null;
  payment_method: PaymentMethod;
  confirmed_at: string | null;
  status: LeadStatus;
  final_price: number | string | null;
  scheduled_for: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  notification_sms_sent: boolean;
  notification_email_sent: boolean;
  notification_error: string | null;
  admin_notes: string | null;
  assigned_crew: string | null;
  source: string | null;
  customer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  zip_code: string | null;
  city: string | null;
  notes: string | null;
  total_jobs: number;
  total_revenue: number | string;
  last_service_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerHistoryRow {
  customer_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  zip_code: string | null;
  total_requests: number;
  completed_jobs: number;
  scheduled_jobs: number;
  cancelled_jobs: number;
  total_paid: number | string;
  last_requested_date: string | null;
  last_activity_at: string | null;
}

export interface GalleryItem {
  id: string;
  title: string | null;
  description: string | null;
  storage_path: string | null;
  public_url: string;
  service_key: string | null;
  location: string | null;
  taken_on: string | null;
  is_carousel: boolean;
  carousel_order: number | null;
  is_published: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface PricingRule {
  id: string;
  name: string;
  service_key: string | null;
  min_sq_ft: number | string;
  max_sq_ft: number | string | null;
  price: number | string;
  price_per_sq_ft: number | string | null;
  price_per_cubic_yard: number | string | null;
  default_depth_inches: number | string;
  capacity_per_day: number;
  duration_minutes: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: string;
  lead_id: string | null;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  reminder_at: string | null;
  reminder_sent: boolean;
  all_day: boolean;
  created_at: string;
  updated_at: string;
}

export interface DashboardMetrics {
  total_leads: number;
  pending_leads: number;
  scheduled_leads: number;
  completed_jobs: number;
  cancelled_leads: number;
  total_revenue: number | string;
  pipeline_revenue: number | string;
  total_sq_ft_measured: number | string;
  total_customers: number;
  average_ticket: number | string;
}

export type LeadStatusAction = "confirm" | "pending" | "cancel" | "complete";

export type ApiResponse<T = unknown> = {
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
};