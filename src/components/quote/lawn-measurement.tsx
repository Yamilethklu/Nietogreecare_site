'use client';
import * as React from 'react';
import { loadGoogleMaps } from '@/lib/google-maps';
import { polygonAreaSquareFeet } from '@/lib/geo';
import type { PolygonPoint, QuoteMeasurement } from '@/lib/types';
import { buildMeasurement } from '@/store/quote-store';

type Props = { latitude: number | null; longitude: number | null; measurement: QuoteMeasurement | null; onChange: (value: QuoteMeasurement) => void; onClear: () => void; isEs: boolean };
export function LawnMeasurement({ latitude, longitude, measurement, onChange, onClear, isEs }: Props) {
  const host = React.useRef<HTMLDivElement>(null);
  const map = React.useRef<any>(null);
  const shapes = React.useRef<any[]>([]);
  const currentShape = React.useRef<any>(null);
  const finished = React.useRef<PolygonPoint[][]>([]);
  const points = React.useRef<PolygonPoint[]>([]);
  const [ready, setReady] = React.useState(false);
  const [count, setCount] = React.useState(0);
  const [sections, setSections] = React.useState(measurement?.polygons?.length ?? (measurement?.polygon.length ? 1 : 0));
  const [error, setError] = React.useState(false);
  const change = React.useRef(onChange); change.current = onChange;
  const draw = (g:any, instance:any, path:PolygonPoint[]) => new g.Polygon({ map:instance, paths:path, strokeColor:'#93ef22', strokeWeight:3, fillColor:'#5cd524', fillOpacity:0.36, clickable:false });
  const sync = () => { const polygons=[...finished.current, ...(points.current.length >= 3 ? [points.current] : [])]; setCount(points.current.length);setSections(polygons.length);if(polygons.length)change.current(buildMeasurement(polygons[0],polygons.reduce((n,shape)=>n+polygonAreaSquareFeet(shape),0),2,map.current?.getZoom(),polygons));else onClear(); };
  React.useEffect(() => {
    if (latitude == null || longitude == null || !host.current) return;
    let cancelled = false;
    void loadGoogleMaps().then((ok) => {
      if (cancelled || !ok || !host.current) { if (!cancelled) setError(true); return; }
      const g = window.google!.maps;
      const instance = new g.Map(host.current, { center: {lat:latitude,lng:longitude}, zoom:20, mapTypeId:'satellite', streetViewControl:false, mapTypeControl:false, fullscreenControl:false, gestureHandling:'greedy', clickableIcons:false });
      map.current = instance;
      finished.current = measurement?.polygons ?? (measurement?.polygon.length ? [measurement.polygon] : []);
      points.current = [];
      shapes.current = finished.current.map(path=>draw(g,instance,path));
      currentShape.current = draw(g,instance,[]);
      setSections(finished.current.length);
      setCount(0);
      setReady(true);
      instance.addListener('click', (event: any) => {
        if (points.current.length >= 40 || finished.current.length >= 8) return;
        points.current = [...points.current,{ lat:event.latLng.lat(), lng:event.latLng.lng() }];
        currentShape.current.setPath(points.current);
        sync();
      });
    });
    return () => { cancelled = true; shapes.current.forEach(shape=>shape.setMap(null));currentShape.current?.setMap(null);map.current = null; };
    // Keep active map while drawing and rerendering.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude]);
  const nextSection = () => {if(points.current.length < 3)return;finished.current=[...finished.current,points.current];shapes.current.push(currentShape.current);currentShape.current=draw(window.google!.maps,map.current,[]);points.current=[];setCount(0);setSections(finished.current.length);};
  const clear = () => {finished.current=[];shapes.current.forEach(shape=>shape.setMap(null));shapes.current=[];points.current=[];currentShape.current?.setPath([]);setCount(0);setSections(0);onClear();};
  const undo = () => {points.current=points.current.slice(0,-1);currentShape.current?.setPath(points.current);sync();};
  return <div className="space-y-3"><p className="text-sm text-slate-700">{isEs ? 'Toca las esquinas de cada sección de césped (mínimo 3 puntos). Si el frente y el patio están separados, usa “Agregar otra área”. Excluye casa, entrada y calle.' : 'Tap the corners of each lawn section (at least 3 points). Use “Add another area” for separate front and back lawns. Exclude house, driveway and street.'}</p><div className="relative h-80 overflow-hidden rounded-xl border-2 border-lime-500 bg-emerald-950 sm:h-[460px]"><div ref={host} className="absolute inset-0" />{!ready && <div className="pointer-events-none absolute inset-0 grid place-items-center text-center text-white">{error ? (isEs ? 'No se pudo cargar Google Maps. Comprueba la dirección o vuelve a intentarlo.' : 'Google Maps could not load. Check the address or retry.') : (isEs ? 'Cargando satélite…' : 'Loading satellite…')}</div>}</div><div className="flex flex-wrap items-center gap-3"><button type="button" onClick={undo} disabled={!count} className="rounded-lg border border-emerald-600 px-4 py-2 text-emerald-800 disabled:opacity-40">{isEs ? 'Deshacer punto' : 'Undo point'}</button><button type="button" onClick={nextSection} disabled={count<3||sections>=8} className="rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-white disabled:opacity-40">{isEs ? 'Agregar otra área' : 'Add another area'}</button><button type="button" onClick={clear} disabled={!count&&!sections} className="rounded-lg border border-slate-300 px-4 py-2 text-slate-800 disabled:opacity-40">{isEs ? 'Volver a medir' : 'Start over'}</button><strong className="ml-auto text-lg text-emerald-800">{measurement ? `${Math.round(measurement.areaSqFt).toLocaleString()} sq ft · ${sections} ${isEs ? 'áreas' : 'areas'}` : `${count} ${isEs ? 'puntos' : 'points'}`}</strong></div><p className="text-xs text-slate-600">{isEs ? 'Medición aproximada; revisaremos el área antes de comenzar.' : 'Approximate measurement; we will verify the area before starting.'}</p></div>;
}
