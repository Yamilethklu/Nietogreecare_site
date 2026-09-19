"use client";

import * as React from "react";
import { LoaderCircle, MapPin } from "lucide-react";

import { FieldHint, Input, Label } from "@/components/ui/input";
import { ZIP_CITY_MAP } from "@/lib/constants";
import { useQuoteStore } from "@/store/quote-store";

declare global {
  interface Window {
    google?: any;
  }
}

const AUSTIN_CENTER = { lat: 30.2672, lng: -97.7431 };

type AddressAutocompleteProps = {
  mapsReady: boolean;
  error?: string;
  isEs: boolean;
};

/** Campo de dirección con menú de sugerencias propio usando Google Places. */
export function Step1Address({ mapsReady, error, isEs }: AddressAutocompleteProps) {
  const store = useQuoteStore();
  const [predictions, setPredictions] = React.useState<any[]>([]);
  const [loadingPredictions, setLoadingPredictions] = React.useState(false);
  const [selectingPlace, setSelectingPlace] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const autocompleteService = React.useRef<any>(null);
  const placesService = React.useRef<any>(null);
  const placesNode = React.useRef<HTMLDivElement>(null);
  const requestId = React.useRef(0);

  React.useEffect(() => {
    if (!mapsReady || !window.google?.maps?.places || !placesNode.current) return;
    autocompleteService.current = new window.google.maps.places.AutocompleteService();
    placesService.current = new window.google.maps.places.PlacesService(placesNode.current);
  }, [mapsReady]);

  React.useEffect(() => {
    const input = store.address.trim();
    if (!mapsReady || !autocompleteService.current || input.length < 3) {
      setPredictions([]);
      setOpen(false);
      setLoadingPredictions(false);
      return;
    }

    const currentRequest = ++requestId.current;
    setLoadingPredictions(true);
    const timer = window.setTimeout(() => {
      const location = new window.google.maps.LatLng(AUSTIN_CENTER.lat, AUSTIN_CENTER.lng);
      autocompleteService.current.getPlacePredictions(
        {
          input,
          componentRestrictions: { country: "us" },
          location,
          radius: 50000,
          types: ["address"],
        },
        (results: any[] | null, status: string) => {
          if (currentRequest !== requestId.current) return;
          const ok = status === window.google.maps.places.PlacesServiceStatus.OK;
          setPredictions(ok && results ? results : []);
          setOpen(ok && Boolean(results?.length));
          setLoadingPredictions(false);
        },
      );
    }, 200);
    return () => window.clearTimeout(timer);
  }, [mapsReady, store.address]);

  const selectPrediction = (prediction: any) => {
    if (!placesService.current || !window.google?.maps?.places) return;
    setSelectingPlace(true);
    setOpen(false);
    setPredictions([]);
    placesService.current.getDetails(
      {
        placeId: prediction.place_id,
        fields: ["formatted_address", "address_components", "geometry", "place_id"],
      },
      (place: any, status: string) => {
        setSelectingPlace(false);
        if (status !== window.google.maps.places.PlacesServiceStatus.OK || !place) return;
        const postalCode = place.address_components?.find((part: any) => part.types.includes("postal_code"))?.long_name ?? "";
        const city = place.address_components?.find((part: any) => part.types.includes("locality"))?.long_name ?? ZIP_CITY_MAP[postalCode] ?? store.city;
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
  };

  const isBusy = loadingPredictions || selectingPlace;
  return <div className="relative"><div ref={placesNode} className="hidden" aria-hidden="true" /><Label htmlFor="quote-address">{isEs ? "Dirección completa" : "Full address"}</Label><div className="relative mt-2"><Input id="quote-address" value={store.address} onChange={(event) => store.setAddress({ address: event.target.value, formattedAddress: "", placeId: null, latitude: null, longitude: null })} onFocus={() => setOpen(predictions.length > 0)} placeholder="1200 Barton Springs Rd, Austin, TX" autoComplete="off" aria-autocomplete="list" aria-expanded={open} aria-controls="quote-address-suggestions" aria-invalid={Boolean(error)} /><span className="pointer-events-none absolute inset-y-0 right-4 flex items-center">{isBusy ? <LoaderCircle className="size-4 animate-spin text-gold-300" /> : <MapPin className="size-4 text-ink-400" />}</span></div>{open && <ul id="quote-address-suggestions" role="listbox" className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-gold-500/30 bg-ink-950 py-1 shadow-luxury">{predictions.map((prediction) => <li key={prediction.place_id} role="option" aria-selected="false"><button type="button" className="flex w-full items-start gap-3 px-4 py-3 text-left text-sm text-ink-100 transition hover:bg-forest-900/60" onMouseDown={(event) => event.preventDefault()} onClick={() => selectPrediction(prediction)}><MapPin className="mt-0.5 size-4 shrink-0 text-gold-300" /><span><span className="block font-medium text-white">{prediction.structured_formatting?.main_text ?? prediction.description}</span><span className="mt-0.5 block text-xs text-ink-400">{prediction.structured_formatting?.secondary_text ?? "United States"}</span></span></button></li>)}</ul>}</div>;
}

export function Step1AddressHint({ mapsReady, isEs }: Pick<AddressAutocompleteProps, "mapsReady" | "isEs">) {
  return <FieldHint className="mt-2">{mapsReady ? (isEs ? "Escriba al menos tres caracteres y seleccione una dirección sugerida para ubicar la propiedad." : "Type at least three characters and select a suggested address to locate the property.") : (isEs ? "Cargando sugerencias de direcciones…" : "Loading address suggestions…")}</FieldHint>;
}