"use client";

import * as React from "react";
import { Check, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";
import { AUSTIN_CENTER, loadGoogleMaps } from "@/lib/google-maps";
import { buildMeasurement, useQuoteStore } from "@/store/quote-store";
import type { PolygonPoint } from "@/lib/types";

const AREA_OPTIONS = [
  { key: "small", label: "Pequeño", range: "Hasta 2,500 pies cuadrados", areaSqFt: 1250 },
  { key: "medium", label: "Mediano", range: "2,500 - 5,000 pies cuadrados", areaSqFt: 3750 },
  { key: "large", label: "Grande", range: "5,000 - 10,000 pies cuadrados", areaSqFt: 7500 },
  { key: "extra-large", label: "XL", range: "10,000+ pies cuadrados", areaSqFt: 12500 },
] as const;

export function QuoteAreaMap({ isEs }: { isEs: boolean }) {
  const latitude = useQuoteStore((state) => state.latitude);
  const longitude = useQuoteStore((state) => state.longitude);
  const measurement = useQuoteStore((state) => state.measurement);
  const setMeasurement = useQuoteStore((state) => state.setMeasurement);
  const clearMeasurement = useQuoteStore((state) => state.clearMeasurement);
  const [mapsReady, setMapsReady] = React.useState(false);
  const [areaSqFt, setAreaSqFt] = React.useState(measurement?.areaSqFt ?? 0);
  const [drawn, setDrawn] = React.useState(Boolean(measurement?.polygon?.length));
  const mapNode = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<any>(null);
  const managerRef = React.useRef<any>(null);
  const polygonRef = React.useRef<any>(null);

  React.useEffect(() => {
    void loadGoogleMaps().then(setMapsReady).catch(() => setMapsReady(false));
  }, []);

  React.useEffect(() => {
    if (!mapsReady || !mapNode.current || !window.google?.maps) return;
    const g = window.google.maps;
    const map = new g.Map(mapNode.current, {
      center: { lat: latitude ?? AUSTIN_CENTER.lat, lng: longitude ?? AUSTIN_CENTER.lng },
      zoom: 19,
      mapTypeId: "hybrid",
      streetViewControl: false,
      fullscreenControl: false,
    });
    mapRef.current = map;

    const save = (polygon: any) => {
      const path = polygon.getPath();
      const points = path.getArray().map((point: any) => ({ lat: point.lat(), lng: point.lng() })) as PolygonPoint[];
      if (points.length < 3 || !g.geometry?.spherical) return;
      const area = Math.round(g.geometry.spherical.computeArea(path) * 10.7639);
      setAreaSqFt(area);
      setDrawn(true);
      setMeasurement(buildMeasurement(points, area, useQuoteStore.getState().measurement?.depthInches ?? 2, map.getZoom()));
    };

    const bind = (polygon: any) => {
      polygonRef.current = polygon;
      save(polygon);
      ["set_at", "insert_at", "remove_at"].forEach((eventName) => {
        polygon.getPath().addListener(eventName, () => save(polygon));
      });
      polygon.addListener("dragend", () => save(polygon));
    };

    const saved = useQuoteStore.getState().measurement?.polygon;
    if (saved && saved.length >= 3) {
      bind(new g.Polygon({ paths: saved, map, editable: true, draggable: true, strokeColor: "#f5c96b", fillColor: "#f5c96b", fillOpacity: 0.25 }));
    }

    if (g.drawing && g.geometry?.spherical) {
      const manager = new g.drawing.DrawingManager({
        drawingMode: null,
        drawingControl: false,
        polygonOptions: { editable: true, draggable: true, strokeColor: "#f5c96b", fillColor: "#f5c96b", fillOpacity: 0.25 },
      });
      manager.setMap(map);
      managerRef.current = manager;
      const listener = g.event.addListener(manager, "overlaycomplete", (event: any) => {
        if (event.type !== g.drawing.OverlayType.POLYGON) return;
        polygonRef.current?.setMap(null);
        bind(event.overlay);
        manager.setDrawingMode(null);
      });
      return () => {
        g.event.removeListener(listener);
        polygonRef.current?.setMap(null);
        manager.setMap(null);
        mapRef.current = null;
        managerRef.current = null;
      };
    }
    return () => { mapRef.current = null; };
  }, [mapsReady, latitude, longitude, setMeasurement]);

  const startDrawing = () => {
    if (!managerRef.current || !window.google?.maps) return;
    polygonRef.current?.setMap(null);
    polygonRef.current = null;
    setDrawn(false);
    setAreaSqFt(0);
    clearMeasurement();
    managerRef.current.setDrawingMode(window.google.maps.drawing.OverlayType.POLYGON);
    mapRef.current?.setZoom(19);
  };

  const clearArea = () => {
    polygonRef.current?.setMap(null);
    polygonRef.current = null;
    managerRef.current?.setDrawingMode(null);
    setDrawn(false);
    setAreaSqFt(0);
    clearMeasurement();
  };

  const chooseArea = (area: (typeof AREA_OPTIONS)[number]) => {
    polygonRef.current?.setMap(null);
    polygonRef.current = null;
    managerRef.current?.setDrawingMode(null);
    setDrawn(false);
    setAreaSqFt(area.areaSqFt);
    setMeasurement(buildMeasurement([], area.areaSqFt));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="gold" onClick={startDrawing}>
          <Pencil className="size-4" />
          {isEs ? "Dibujar área" : "Draw area"}
        </Button>
        <Button type="button" variant="outline" onClick={clearArea}>
          <Trash2 className="size-4" />
          {isEs ? "Borrar área" : "Clear area"}
        </Button>
      </div>
      <div ref={mapNode} className="h-[420px] overflow-hidden rounded-2xl border border-gold-500/25 bg-ink-950" />
      <div className="rounded-2xl border border-gold-500/25 bg-gold-500/5 p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-gold-200">{isEs ? "Área seleccionada" : "Selected area"}</p>
        <p className="mt-2 text-2xl font-semibold text-white">{formatNumber(areaSqFt)} sq ft</p>
        <p className="mt-1 text-sm text-ink-300">
          {drawn ? (isEs ? "Área guardada automáticamente." : "Area saved automatically.") : (isEs ? "Dibuje el área del trabajo en el mapa." : "Draw the work area on the map.")}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {AREA_OPTIONS.map((area) => (
          <button key={area.key} type="button" onClick={() => chooseArea(area)} className="rounded-2xl border border-white/10 bg-ink-900/50 p-4 text-left hover:border-gold-400/50">
            <span className="flex items-center justify-between text-lg font-semibold text-white">{isEs ? area.label : area.key === "extra-large" ? "XL" : area.key}<Check className="size-4 text-gold-300" /></span>
            <span className="mt-1 block text-sm text-ink-300">{isEs ? area.range : area.key === "small" ? "Up to 2,500 sq ft" : area.key === "medium" ? "2,500 - 5,000 sq ft" : area.key === "large" ? "5,000 - 10,000 sq ft" : "10,000+ sq ft"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
