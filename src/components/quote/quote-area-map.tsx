"use client";

import * as React from "react";
import { Check, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";
import { AUSTIN_CENTER, loadGoogleMaps } from "@/lib/google-maps";
import { buildMeasurement, useQuoteStore } from "@/store/quote-store";
import type { PolygonPoint } from "@/lib/types";

const AREA_OPTIONS = [
  { key: "small", labelEs: "Pequeño", labelEn: "Small", rangeEs: "Hasta 2,500 pies cuadrados", rangeEn: "Up to 2,500 sq ft", areaSqFt: 1250 },
  { key: "medium", labelEs: "Mediano", labelEn: "Medium", rangeEs: "2,500 - 5,000 pies cuadrados", rangeEn: "2,500 - 5,000 sq ft", areaSqFt: 3750 },
  { key: "large", labelEs: "Grande", labelEn: "Large", rangeEs: "5,000 - 10,000 pies cuadrados", rangeEn: "5,000 - 10,000 sq ft", areaSqFt: 7500 },
  { key: "extra-large", labelEs: "XL", labelEn: "XL", rangeEs: "10,000+ pies cuadrados", rangeEn: "10,000+ sq ft", areaSqFt: 12500 },
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
    let active = true;
    void loadGoogleMaps().then((ready) => {
      if (active) setMapsReady(ready);
    });
    return () => { active = false; };
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
      if (!Number.isFinite(area) || area < 0) return;
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
      bind(
        new g.Polygon({
          paths: saved,
          map,
          editable: true,
          draggable: true,
          strokeColor: "#16a34a",
          fillColor: "#22c55e",
          fillOpacity: 0.45,
          strokeWeight: 2,
          clickable: true,
          zIndex: 1,
        })
      );
    }

    let listener: any = null;
    if (g.drawing?.DrawingManager && g.drawing?.OverlayType && g.geometry?.spherical && g.ControlPosition) {
      const manager = new g.drawing.DrawingManager({
        drawingMode: saved && saved.length >= 3 ? null : g.drawing.OverlayType.POLYGON,
        drawingControl: true,
        drawingControlOptions: {
          position: g.ControlPosition.TOP_CENTER,
          drawingModes: [g.drawing.OverlayType.POLYGON],
        },
        polygonOptions: {
          fillColor: "#22c55e",
          fillOpacity: 0.45,
          strokeColor: "#16a34a",
          strokeWeight: 2,
          clickable: true,
          editable: true,
          zIndex: 1,
        },
      });
      manager.setMap(map);
      managerRef.current = manager;
      listener = g.event.addListener(manager, "overlaycomplete", (event: any) => {
        if (event.type !== g.drawing.OverlayType.POLYGON) return;
        polygonRef.current?.setMap(null);
        bind(event.overlay);
        manager.setDrawingMode(null);
      });
    }

    return () => {
      if (listener) g.event.removeListener(listener);
      polygonRef.current?.setMap(null);
      managerRef.current?.setMap(null);
      mapRef.current = null;
      managerRef.current = null;
      polygonRef.current = null;
    };
  }, [mapsReady, latitude, longitude, setMeasurement]);

  const startDrawing = () => {
    const g = window.google?.maps;
    if (!managerRef.current || !g?.drawing?.OverlayType) return;
    polygonRef.current?.setMap(null);
    polygonRef.current = null;
    setDrawn(false);
    setAreaSqFt(0);
    clearMeasurement();
    managerRef.current.setDrawingMode(g.drawing.OverlayType.POLYGON);
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
        <Button type="button" variant="gold" onClick={startDrawing} disabled={!mapsReady}>
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
        <p className="mt-1 text-sm text-ink-300">{drawn ? (isEs ? "Área guardada automáticamente." : "Area saved automatically.") : (isEs ? "Dibuje el área del trabajo en el mapa." : "Draw the work area on the map.")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {AREA_OPTIONS.map((area) => (
          <button key={area.key} type="button" onClick={() => chooseArea(area)} className="rounded-2xl border border-white/10 bg-ink-900/50 p-4 text-left hover:border-gold-400/50">
            <span className="flex items-center justify-between text-lg font-semibold text-white">{isEs ? area.labelEs : area.labelEn}<Check className="size-4 text-gold-300" /></span>
            <span className="mt-1 block text-sm text-ink-300">{isEs ? area.rangeEs : area.rangeEn}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
