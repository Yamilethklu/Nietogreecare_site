"use client";

import * as React from "react";
import { MapPin } from "lucide-react";

import { FieldHint, Input, Label } from "@/components/ui/input";
import { loadGoogleMaps } from "@/lib/google-maps";
import { useQuoteStore } from "@/store/quote-store";

type AddressAutocompleteProps = {
  error?: string;
  isEs: boolean;
};

type AddressSuggestion = {
  id: string;
  label: string;
  address: string;
  city: string;
  zipCode: string;
  state: string;
  latitude: number;
  longitude: number;
};

/**
 * Campo de dirección del primer paso con sugerencias oficiales de Google Places.
 * La búsqueda interna solo sirve como respaldo cuando Maps no está disponible.
 */
export function Step1Address({ error, isEs }: AddressAutocompleteProps) {
  const address = useQuoteStore((state) => state.address);
  const setAddress = useQuoteStore((state) => state.setAddress);
  const [suggestions, setSuggestions] = React.useState<AddressSuggestion[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const [placesReady, setPlacesReady] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const selectedAddressRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    let disposed = false;
    let listener: { remove?: () => void } | null = null;

    void loadGoogleMaps()
      .then((available) => {
        if (disposed || !available || !inputRef.current || !window.google?.maps?.places) return;
        try {
          const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
            fields: ["address_components", "formatted_address", "geometry", "place_id"],
            types: ["address"],
            componentRestrictions: { country: "us" },
          });
          listener = autocomplete.addListener("place_changed", () => {
            try {
              const place = autocomplete.getPlace();
              const location = place.geometry?.location;
              if (!location) return;
              const components = place.address_components ?? [];
              const component = (type: string) => components.find((item: { types?: string[] }) => item.types?.includes(type))?.long_name ?? "";
              selectedAddressRef.current = place.formatted_address ?? inputRef.current?.value ?? null;
              setAddress({
                address: place.formatted_address ?? inputRef.current?.value ?? "",
                formattedAddress: place.formatted_address ?? "",
                city: component("locality") || component("sublocality"),
                zipCode: component("postal_code"),
                state: component("administrative_area_level_1") || "TX",
                placeId: place.place_id ?? null,
                latitude: location.lat(),
                longitude: location.lng(),
              });
              setSuggestions([]);
              setIsOpen(false);
            } catch {
              setPlacesReady(false);
            }
          });
          setPlacesReady(true);
        } catch {
          setPlacesReady(false);
        }
      })
      .catch(() => setPlacesReady(false));

    return () => {
      disposed = true;
      listener?.remove?.();
    };
  }, [setAddress]);

  const updateManualAddress = (address: string) => {
    setAddress({
      address,
      formattedAddress: "",
      placeId: null,
      latitude: null,
      longitude: null,
    });
    setIsOpen(true);
  };

  React.useEffect(() => {
    const query = address.trim();
    if (placesReady) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    if (selectedAddressRef.current === query) {
      selectedAddressRef.current = null;
      return;
    }

    if (query.length < 3) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`/api/address-search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as { suggestions?: AddressSuggestion[] };
        if (!controller.signal.aborted) {
          setSuggestions(payload.suggestions ?? []);
          setIsOpen(true);
        }
      } catch {
        if (!controller.signal.aborted) setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [address, placesReady]);

  const selectSuggestion = (suggestion: AddressSuggestion) => {
    selectedAddressRef.current = suggestion.address;
    setAddress({
      address: suggestion.address,
      formattedAddress: suggestion.label,
      city: suggestion.city,
      zipCode: suggestion.zipCode,
      state: suggestion.state || "TX",
      placeId: suggestion.id,
      latitude: Number.isFinite(suggestion.latitude) ? suggestion.latitude : null,
      longitude: Number.isFinite(suggestion.longitude) ? suggestion.longitude : null,
    });
    setSuggestions([]);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <Label htmlFor="quote-address">{isEs ? "Dirección completa" : "Full address"}</Label>
      <div className="relative mt-2">
        <Input
          id="quote-address"
          ref={inputRef}
          value={address}
          onChange={(event) => updateManualAddress(event.target.value)}
          onFocus={() => setIsOpen(true)}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 150)}
          placeholder={isEs ? "Ej. 1200 Barton Springs Rd, Austin, TX" : "e.g. 1200 Barton Springs Rd, Austin, TX"}
          autoComplete="street-address"
          aria-invalid={Boolean(error)}
          aria-autocomplete="list"
          aria-expanded={isOpen && (suggestions.length > 0 || isSearching)}
          aria-controls="quote-address-suggestions"
          className="pr-11"
        />
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
          <MapPin className="size-4 text-amber-300" />
        </span>
      </div>
      {isOpen && (isSearching || suggestions.length > 0) ? (
        <div
          id="quote-address-suggestions"
          role="listbox"
          className="absolute z-[9999] mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-gold-500/45 bg-slate-900 p-1 shadow-luxury backdrop-blur"
        >
          {isSearching ? (
            <p className="px-3 py-2 text-xs text-ink-400">
              {isEs ? "Buscando direcciones…" : "Searching addresses…"}
            </p>
          ) : (
            suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                role="option"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectSuggestion(suggestion)}
                className="w-full rounded-lg px-3 py-2.5 text-left transition hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
              >
                <span className="block text-sm font-medium text-white">{suggestion.address}</span>
                <span className="mt-0.5 block text-xs text-ink-400">{suggestion.label}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

export function Step1AddressHint({ isEs }: Pick<AddressAutocompleteProps, "isEs">) {
  return (
    <FieldHint className="mt-2">
      {isEs
        ? "Seleccione una sugerencia o escriba la dirección completa manualmente para continuar."
        : "Select a suggestion or enter the full address manually to continue."}
    </FieldHint>
  );
}