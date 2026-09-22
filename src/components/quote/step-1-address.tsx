"use client";

import * as React from "react";
import { LoaderCircle, MapPin, ShieldCheck } from "lucide-react";

import { FieldHint, Input, Label } from "@/components/ui/input";
import { AUSTIN_CENTER } from "@/lib/google-maps";
import { useQuoteStore } from "@/store/quote-store";

type AddressAutocompleteProps = {
  mapsReady: boolean;
  error?: string;
  isEs: boolean;
};

function placeComponent(components: any[], type: string) {
  return components.find((component) => component.types?.includes(type))?.long_name ?? "";
}

/**
 * Campo de dirección con Google Places Autocomplete nativo. El componente se
 * inicializa solo cuando la API está disponible; de lo contrario mantiene el
 * input controlado para captura manual sin bloquear el avance del cotizador.
 */
export function Step1Address({ mapsReady, error, isEs }: AddressAutocompleteProps) {
  const address = useQuoteStore((state) => state.address);
  const setAddress = useQuoteStore((state) => state.setAddress);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const autocompleteRef = React.useRef<any>(null);
  const [placesEnabled, setPlacesEnabled] = React.useState(false);

  React.useEffect(() => {
    const input = inputRef.current;
    if (!mapsReady || !input || !window.google?.maps?.places?.Autocomplete) {
      setPlacesEnabled(false);
      return;
    }

    try {
      const autocomplete = new window.google.maps.places.Autocomplete(input, {
        fields: ["address_components", "formatted_address", "geometry", "place_id"],
        types: ["address"],
        componentRestrictions: { country: "us" },
        bounds: new window.google.maps.LatLngBounds(
          new window.google.maps.LatLng(29.7, -98.45),
          new window.google.maps.LatLng(31.2, -96.8),
        ),
        strictBounds: false,
      });

      autocomplete.setBounds(
        new window.google.maps.LatLngBounds(
          new window.google.maps.LatLng(AUSTIN_CENTER.lat - 0.8, AUSTIN_CENTER.lng - 0.9),
          new window.google.maps.LatLng(AUSTIN_CENTER.lat + 0.8, AUSTIN_CENTER.lng + 0.9),
        ),
      );
      autocompleteRef.current = autocomplete;
      setPlacesEnabled(true);

      const listener = autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        const formattedAddress = place.formatted_address ?? input.value.trim();
        const components: any[] = place.address_components ?? [];
        const city =
          placeComponent(components, "locality") ||
          placeComponent(components, "postal_town") ||
          placeComponent(components, "sublocality") ||
          "";
        const zipCode = placeComponent(components, "postal_code");
        const state = placeComponent(components, "administrative_area_level_1") || "TX";
        const location = place.geometry?.location;

        setAddress({
          address: formattedAddress,
          formattedAddress,
          city,
          zipCode,
          state,
          placeId: place.place_id ?? null,
          latitude: location?.lat?.() ?? null,
          longitude: location?.lng?.() ?? null,
        });
      });

      return () => {
        window.google?.maps?.event?.removeListener(listener);
        autocompleteRef.current = null;
      };
    } catch {
      autocompleteRef.current = null;
      setPlacesEnabled(false);
    }
  }, [mapsReady, setAddress]);

  const updateManualAddress = (address: string) => {
    setAddress({
      address,
      formattedAddress: "",
      placeId: null,
      latitude: null,
      longitude: null,
    });
  };

  return (
    <div className="relative">
      <Label htmlFor="quote-address">{isEs ? "Dirección completa" : "Full address"}</Label>
      <div className="relative mt-2">
        <Input
          ref={inputRef}
          id="quote-address"
          value={address}
          onChange={(event) => updateManualAddress(event.target.value)}
          placeholder={isEs ? "Ej. 1200 Barton Springs Rd, Austin, TX" : "e.g. 1200 Barton Springs Rd, Austin, TX"}
          autoComplete="street-address"
          aria-invalid={Boolean(error)}
          className="pr-11"
        />
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
          {mapsReady && !placesEnabled ? (
            <LoaderCircle className="size-4 animate-spin text-amber-300" />
          ) : (
            <MapPin className="size-4 text-amber-300" />
          )}
        </span>
      </div>

      {placesEnabled ? (
        <FieldHint className="mt-2 flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-amber-300" />
          {isEs
            ? "Seleccione una sugerencia para guardar automáticamente ciudad, código ZIP y ubicación."
            : "Select a suggestion to save the city, ZIP code, and location automatically."}
        </FieldHint>
      ) : null}
    </div>
  );
}

export function Step1AddressHint({ mapsReady, isEs }: Pick<AddressAutocompleteProps, "mapsReady" | "isEs">) {
  return (
    <FieldHint className="mt-2">
      {mapsReady
        ? isEs
          ? "También puede escribir la dirección manualmente si no aparece una sugerencia."
          : "You can also enter the address manually if no suggestion appears."
        : isEs
          ? "Puede escribir la dirección manualmente mientras cargan las sugerencias."
          : "You can enter the address manually while suggestions load."}
    </FieldHint>
  );
}