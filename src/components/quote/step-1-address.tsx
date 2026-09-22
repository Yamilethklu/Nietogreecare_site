"use client";

import * as React from "react";
import { LoaderCircle, MapPin, ShieldCheck } from "lucide-react";

import { FieldHint, Input, Label } from "@/components/ui/input";
import { SERVICE_CITIES, ZIP_CITY_MAP } from "@/lib/constants";
import { AUSTIN_CENTER } from "@/lib/google-maps";
import { cn } from "@/lib/utils";
import { useQuoteStore } from "@/store/quote-store";

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 220;
const SEARCH_RADIUS_METERS = 50000;

type AddressAutocompleteProps = {
  mapsReady: boolean;
  error?: string;
  isEs: boolean;
};

type PlacePrediction = {
  place_id: string;
  description: string;
  structured_formatting?: { main_text?: string; secondary_text?: string };
};

/** Ciudad de cobertura presente en la sugerencia (Austin, Hutto, Round Rock, Georgetown o Cedar Park). */
function coverageCity(prediction: PlacePrediction): string | null {
  const haystack = `${
    prediction.structured_formatting?.secondary_text ?? ""
  } ${prediction.description}`.toLowerCase();
  return SERVICE_CITIES.find((city) => haystack.includes(city.toLowerCase())) ?? null;
}

/**
 * Campo de direccion con autocompletado de Google Places: despliega las
 * sugerencias justo debajo del input, navegables con teclado (flechas, Enter y
 * Esc) y etiqueta las direcciones que ya estan dentro de la zona de cobertura.
 */
export function Step1Address({ mapsReady, error, isEs }: AddressAutocompleteProps) {
  const store = useQuoteStore();
  const [predictions, setPredictions] = React.useState<PlacePrediction[]>([]);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [open, setOpen] = React.useState(false);
  const [loadingPredictions, setLoadingPredictions] = React.useState(false);
  const [selectingPlace, setSelectingPlace] = React.useState(false);
  const [noResults, setNoResults] = React.useState(false);
  const containerNode = React.useRef<HTMLDivElement>(null);
  const placesNode = React.useRef<HTMLDivElement>(null);
  const autocompleteService = React.useRef<any>(null);
  const placesService = React.useRef<any>(null);
  const sessionToken = React.useRef<any>(null);
  const requestId = React.useRef(0);
  const skipNextQuery = React.useRef(false);

  /* Servicios de Places (sugerencias + detalle) una vez cargada la API. */
  React.useEffect(() => {
    if (!mapsReady || !window.google?.maps?.places || !placesNode.current) return;
    try {
      autocompleteService.current = new window.google.maps.places.AutocompleteService();
      placesService.current = new window.google.maps.places.PlacesService(placesNode.current);
      sessionToken.current = new window.google.maps.places.AutocompleteSessionToken();
    } catch {
      autocompleteService.current = null;
      placesService.current = null;
      sessionToken.current = null;
    }
  }, [mapsReady]);

  /* Sugerencias con retardo (debounce) sesgadas al area metropolitana de Austin. */
  React.useEffect(() => {
    if (skipNextQuery.current) {
      skipNextQuery.current = false;
      return;
    }

    const query = store.address.trim();
    if (!mapsReady || !autocompleteService.current || query.length < MIN_QUERY_LENGTH) {
      setPredictions([]);
      setActiveIndex(-1);
      setOpen(false);
      setNoResults(false);
      setLoadingPredictions(false);
      return;
    }

    const currentRequest = ++requestId.current;
    setLoadingPredictions(true);
    const timer = window.setTimeout(() => {
      try {
        const location = new window.google.maps.LatLng(AUSTIN_CENTER.lat, AUSTIN_CENTER.lng);
        autocompleteService.current.getPlacePredictions(
        {
          input: query,
          componentRestrictions: { country: "us" },
          location,
          radius: SEARCH_RADIUS_METERS,
          types: ["address"],
          sessionToken: sessionToken.current,
        },
        (results: PlacePrediction[] | null, status: string) => {
          if (currentRequest !== requestId.current) return;
          const ok = status === window.google.maps.places.PlacesServiceStatus.OK;
          const items = ok && results ? results.slice(0, 6) : [];
          setPredictions(items);
          setActiveIndex(items.length ? 0 : -1);
          setOpen(items.length > 0);
          setNoResults(items.length === 0);
          setLoadingPredictions(false);
          },
        );
      } catch {
        if (currentRequest !== requestId.current) return;
        setPredictions([]);
        setOpen(false);
        setNoResults(true);
        setLoadingPredictions(false);
      }
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [mapsReady, store.address]);

  /* Cierra la lista al hacer clic fuera del campo. */
  React.useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!containerNode.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const selectPrediction = (prediction: PlacePrediction) => {
    if (!placesService.current || !window.google?.maps?.places) return;
    setSelectingPlace(true);
    setOpen(false);
    setNoResults(false);
    setPredictions([]);
    setActiveIndex(-1);

    try {
      placesService.current.getDetails(
      {
        placeId: prediction.place_id,
        fields: ["formatted_address", "address_components", "geometry", "place_id"],
        sessionToken: sessionToken.current,
      },
      (place: any, status: string) => {
        setSelectingPlace(false);
        if (status !== window.google.maps.places.PlacesServiceStatus.OK || !place) return;

        const components: any[] = place.address_components ?? [];
        const postalCode =
          components.find((part) => part.types?.includes("postal_code"))?.long_name ?? "";
        const city =
          components.find((part) => part.types?.includes("locality"))?.long_name ??
          ZIP_CITY_MAP[postalCode] ??
          store.city;

        /* La direccion ya quedo elegida: evita reabrir la lista de sugerencias. */
        skipNextQuery.current = true;
        sessionToken.current = new window.google.maps.places.AutocompleteSessionToken();

        store.setAddress({
          address: place.formatted_address ?? prediction.description,
          formattedAddress: place.formatted_address ?? prediction.description,
          ...(store.zipCode ? {} : { zipCode: postalCode }),
          city,
          placeId: place.place_id ?? prediction.place_id,
          latitude: place.geometry?.location?.lat() ?? null,
          longitude: place.geometry?.location?.lng() ?? null,
        });
        },
      );
    } catch {
      setSelectingPlace(false);
      skipNextQuery.current = true;
      store.setAddress({
        address: prediction.description,
        formattedAddress: prediction.description,
        placeId: prediction.place_id,
      });
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!predictions.length) return;
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => {
        const step = event.key === "ArrowDown" ? 1 : -1;
        return (current + step + predictions.length) % predictions.length;
      });
      return;
    }

    if (event.key === "Enter") {
      if (open && activeIndex >= 0 && predictions[activeIndex]) {
        event.preventDefault();
        selectPrediction(predictions[activeIndex]);
      }
      return;
    }

    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  const isBusy = loadingPredictions || selectingPlace;

  return (
    <div ref={containerNode} className="relative">
      <div ref={placesNode} className="hidden" aria-hidden="true" />
      <Label htmlFor="quote-address">{isEs ? "Dirección completa" : "Full address"}</Label>

      <div className="relative mt-2">
        <Input
          id="quote-address"
          value={store.address}
          onChange={(event) =>
            store.setAddress({
              address: event.target.value,
              formattedAddress: "",
              placeId: null,
              latitude: null,
              longitude: null,
            })
          }
          onFocus={() => setOpen(predictions.length > 0)}
          onKeyDown={onKeyDown}
          placeholder="1200 Barton Springs Rd, Austin, TX"
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="quote-address-suggestions"
          aria-activedescendant={
            open && activeIndex >= 0 ? `quote-address-option-${activeIndex}` : undefined
          }
          aria-invalid={Boolean(error)}
          className="pr-11"
        />
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
          {isBusy ? (
            <LoaderCircle className="size-4 animate-spin text-gold-300" />
          ) : (
            <MapPin className="size-4 text-ink-400" />
          )}
        </span>
      </div>

      {open ? (
        <ul
          id="quote-address-suggestions"
          role="listbox"
          aria-label={isEs ? "Sugerencias de direcciones" : "Address suggestions"}
          className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-gold-500/30 bg-ink-950 py-1 shadow-luxury"
        >
          {predictions.map((prediction, index) => {
            const city = coverageCity(prediction);
            const main = prediction.structured_formatting?.main_text ?? prediction.description;
            const secondary =
              prediction.structured_formatting?.secondary_text ??
              (isEs ? "Estados Unidos" : "United States");

            return (
              <li
                key={prediction.place_id}
                id={`quote-address-option-${index}`}
                role="option"
                aria-selected={index === activeIndex}
              >
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectPrediction(prediction)}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-3 text-left text-sm text-ink-100 transition",
                    index === activeIndex ? "bg-forest-900/60" : "hover:bg-forest-900/40",
                  )}
                >
                  <MapPin className="mt-0.5 size-4 shrink-0 text-gold-300" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-white">{main}</span>
                    <span className="mt-0.5 block truncate text-xs text-ink-400">{secondary}</span>
                  </span>
                  {city ? (
                    <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-200">
                      <ShieldCheck className="size-3" />
                      {city}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {noResults ? (
        <FieldHint className="mt-2">
          {isEs
            ? "Sin sugerencias. Escriba la dirección completa o ubique su propiedad en el mapa del paso 2."
            : "No suggestions. Type the full address or locate your property on the map in step 2."}
        </FieldHint>
      ) : null}
    </div>
  );
}

export function Step1AddressHint({
  mapsReady,
  isEs,
}: Pick<AddressAutocompleteProps, "mapsReady" | "isEs">) {
  return (
    <FieldHint className="mt-2">
      {mapsReady
        ? isEs
          ? "Escriba al menos tres caracteres y seleccione una dirección sugerida para ubicar la propiedad."
          : "Type at least three characters and select a suggested address to locate the property."
        : isEs
          ? "Cargando sugerencias de direcciones…"
          : "Loading address suggestions…"}
    </FieldHint>
  );
}
