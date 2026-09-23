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
      try {
        if (!polygon || !g.geometry?.spherical) return;
        const path = polygon.getPath?.();
        if (!path) return;
        const rawArray = path.getArray ? path.getArray() : [];
        const points: PolygonPoint[] = [];
        for (const pt of rawArray) {
          const lat = typeof pt?.lat === "function" ? pt.lat() : Number(pt?.lat);
          const lng = typeof pt?.lng === "function" ? pt.lng() : Number(pt?.lng);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            points.push({ lat, lng });
          }
        }
        if (points.length < 3) return;
        const area = Math.round(g.geometry.spherical.computeArea(path) * 10.7639);
        if (!Number.isFinite(area) || area < 0) return;
        setAreaSqFt(area);
        setDrawn(true);
        setMeasurement(buildMeasurement(points, area, useQuoteStore.getState().measurement?.depthInches ?? 2, map.getZoom()));
      } catch (err) {
        console.error("Error saving measurement:", err);
      }
    };

    const bind = (polygon: any) => {
      try {
        polygonRef.current = polygon;
        polygon.setEditable?.(true);
        polygon.setDraggable?.(true);
        polygon.setOptions?.({
          strokeColor: "#16a34a",
          strokeWeight: 2.5,
          fillColor: "#22c55e",
          fillOpacity: 0.45,
          clickable: true,
          zIndex: 10,
        });
        save(polygon);
        const path = polygon.getPath?.();
        if (path) {
          ["set_at", "insert_at", "remove_at"].forEach((eventName) => {
            path.addListener?.(eventName, () => save(polygon));
          });
        }
        polygon.addListener?.("dragend", () => save(polygon));
      } catch (err) {
        console.error("Error binding polygon:", err);
      }
    };

    const saved = useQuoteStore.getState().measurement?.polygon;
    if (Array.isArray(saved) && saved.length >= 3) {
      try {
        bind(
          new g.Polygon({
            paths: saved,
            map,
            editable: true,
            draggable: true,
            strokeColor: "#16a34a",
            fillColor: "#22c55e",
            fillOpacity: 0.45,
            strokeWeight: 2.5,
            clickable: true,
            zIndex: 10,
          })
        );
      } catch (err) {
        console.error("Error rendering saved polygon:", err);
      }
    }

    let listener: any = null;
    let timerId: any = null;
    let cancelled = false;

    const initDrawingManager = async () => {
      if (cancelled) return;

      try {
        if (!g.drawing?.DrawingManager && typeof g.importLibrary === "function") {
          try {
            await g.importLibrary("drawing");
          } catch {
            // ignore
          }
        }

        if (!g.drawing?.DrawingManager || !g.drawing?.OverlayType || !g.geometry?.spherical || !g.ControlPosition) {
          if (!cancelled) {
            timerId = setTimeout(initDrawingManager, 100);
          }
          return;
        }

        if (cancelled) return;

        const currentSaved = useQuoteStore.getState().measurement?.polygon;
        const manager = new g.drawing.DrawingManager({
          drawingMode: Array.isArray(currentSaved) && currentSaved.length >= 3 ? null : g.drawing.OverlayType.POLYGON,
          drawingControl: true,
          drawingControlOptions: {
            position: g.ControlPosition.TOP_CENTER,
            drawingModes: [
              g.drawing.OverlayType.POLYGON,
              g.drawing.OverlayType.RECTANGLE,
            ],
          },
          polygonOptions: {
            fillColor: "#22c55e",
            fillOpacity: 0.45,
            strokeColor: "#16a34a",
            strokeWeight: 2.5,
            clickable: true,
            editable: true,
            draggable: true,
            zIndex: 10,
          },
        });
        manager.setMap(map);
        managerRef.current = manager;
        listener = g.event.addListener(manager, "overlaycomplete", (event: any) => {
          if (event.type === g.drawing.OverlayType.POLYGON) {
            polygonRef.current?.setMap(null);
            bind(event.overlay);
            manager.setDrawingMode(null);
          } else if (event.type === g.drawing.OverlayType.RECTANGLE) {
            const bounds = event.overlay.getBounds();
            const ne = bounds.getNorthEast();
            const sw = bounds.getSouthWest();
            const rectPolygon = new g.Polygon({
              paths: [
                { lat: ne.lat(), lng: ne.lng() },
                { lat: ne.lat(), lng: sw.lng() },
                { lat: sw.lat(), lng: sw.lng() },
                { lat: sw.lat(), lng: ne.lng() },
              ],
              map,
              editable: true,
              draggable: true,
              strokeColor: "#16a34a",
              fillColor: "#22c55e",
              fillOpacity: 0.45,
              strokeWeight: 2.5,
            });
            event.overlay.setMap(null);
            polygonRef.current?.setMap(null);
            bind(rectPolygon);
            manager.setDrawingMode(null);
          }
        });
      } catch (err) {
        console.error("Error initializing DrawingManager:", err);
      }
    };

    void initDrawingManager();

    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
      if (listener && g?.event) g.event.removeListener(listener);
      try {
        polygonRef.current?.setMap(null);
        managerRef.current?.setMap(null);
      } catch {
        // ignore cleanup error
      }
      mapRef.current = null;
      managerRef.current = null;
      polygonRef.current = null;
    };
  }, [mapsReady, latitude, longitude, setMeasurement]);

  const startDrawing = async () => {
    const g = window.google?.maps;
    if (!g) return;
    if (!managerRef.current && typeof g.importLibrary === "function") {
      try {
        await g.importLibrary("drawing");
      } catch {
        // ignore
      }
    }
    polygonRef.current?.setMap(null);
    polygonRef.current = null;
    setDrawn(false);
    setAreaSqFt(0);
    clearMeasurement();

    if (managerRef.current && g.drawing?.OverlayType) {
      managerRef.current.setMap(mapRef.current);
      managerRef.current.setDrawingMode(g.drawing.OverlayType.POLYGON);
    }
    if (mapRef.current) {
      mapRef.current.setZoom(19);
    }
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

    const g = window.google?.maps;
    const centerLat = latitude ?? AUSTIN_CENTER.lat;
    const centerLng = longitude ?? AUSTIN_CENTER.lng;

    if (g && mapRef.current && g.geometry?.spherical) {
      const areaSqMeters = area.areaSqFt / 10.7639;
      const halfSideMeters = Math.sqrt(areaSqMeters) / 2;

      const p1 = g.geometry.spherical.computeOffset(
        g.geometry.spherical.computeOffset({ lat: centerLat, lng: centerLng }, halfSideMeters, 0),
        halfSideMeters,
        90
      );
      const p2 = g.geometry.spherical.computeOffset(
        g.geometry.spherical.computeOffset({ lat: centerLat, lng: centerLng }, halfSideMeters, 0),
        halfSideMeters,
        270
      );
      const p3 = g.geometry.spherical.computeOffset(
        g.geometry.spherical.computeOffset({ lat: centerLat, lng: centerLng }, halfSideMeters, 180),
        halfSideMeters,
        270
      );
      const p4 = g.geometry.spherical.computeOffset(
        g.geometry.spherical.computeOffset({ lat: centerLat, lng: centerLng }, halfSideMeters, 180),
        halfSideMeters,
        90
      );

      const points: PolygonPoint[] = [
        { lat: p1.lat(), lng: p1.lng() },
        { lat: p2.lat(), lng: p2.lng() },
        { lat: p3.lat(), lng: p3.lng() },
        { lat: p4.lat(), lng: p4.lng() },
      ];

      const polygon = new g.Polygon({
        paths: points,
        map: mapRef.current,
        editable: true,
        draggable: true,
        strokeColor: "#16a34a",
        fillColor: "#22c55e",
        fillOpacity: 0.45,
        strokeWeight: 2.5,
        zIndex: 10,
      });

      polygonRef.current = polygon;
      polygon.setEditable?.(true);
      polygon.setDraggable?.(true);

      const savePoly = () => {
        try {
          const path = polygon.getPath?.();
          if (!path) return;
          const rawArray = path.getArray ? path.getArray() : [];
          const pts: PolygonPoint[] = [];
          for (const pt of rawArray) {
            const lat = typeof pt?.lat === "function" ? pt.lat() : Number(pt?.lat);
            const lng = typeof pt?.lng === "function" ? pt.lng() : Number(pt?.lng);
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
              pts.push({ lat, lng });
            }
          }
          if (pts.length < 3) return;
          const currentArea = Math.round(g.geometry.spherical.computeArea(path) * 10.7639);
          setAreaSqFt(currentArea);
          setDrawn(true);
          setMeasurement(buildMeasurement(pts, currentArea, useQuoteStore.getState().measurement?.depthInches ?? 2, mapRef.current?.getZoom()));
        } catch {
          // ignore
        }
      };

      savePoly();

      const path = polygon.getPath?.();
      if (path) {
        ["set_at", "insert_at", "remove_at"].forEach((evt) => {
          path.addListener?.(evt, savePoly);
        });
      }
      polygon.addListener?.("dragend", savePoly);

      mapRef.current.panTo({ lat: centerLat, lng: centerLng });
    } else {
      setDrawn(false);
      setAreaSqFt(area.areaSqFt);
      setMeasurement(buildMeasurement([], area.areaSqFt));
    }
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
