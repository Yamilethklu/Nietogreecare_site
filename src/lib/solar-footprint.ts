import { fromArrayBuffer } from 'geotiff';
import { contours } from 'd3-contour';
import proj4 from 'proj4';
import * as turf from '@turf/turf';
import { asAreaFeature, type AreaFeature } from './parcel-geometry';

/** Vectorize Google's rooftop mask in its declared CRS, then clip to the parcel. */
export async function solarMaskFootprint(lat:number,lng:number,key:string,parcel:AreaFeature):Promise<AreaFeature|null>{
 if(!key)return null;
 try{
  const bbox=turf.bbox(parcel);
  const radius=Math.max(...[[bbox[0],bbox[1]],[bbox[2],bbox[3]]].map(point=>turf.distance(turf.point([lng,lat]),turf.point(point),{units:'meters'})))+5;
  if(radius>100)return null;
  const url=new URL('https://solar.googleapis.com/v1/dataLayers:get');
  url.search=new URLSearchParams({'location.latitude':String(lat),'location.longitude':String(lng),radiusMeters:String(Math.max(30,Math.ceil(radius))),view:'IMAGERY_LAYERS',pixelSizeMeters:'0.1',key}).toString();
  const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!response.ok)return null;
  const data=await response.json();if(typeof data.maskUrl!=='string')return null;
  const maskUrl=new URL(data.maskUrl);
  if(maskUrl.protocol!=='https:'||maskUrl.hostname!=='solar.googleapis.com')return null;
  maskUrl.searchParams.set('key',key);
  const mask=await fetch(maskUrl,{cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!mask.ok)return null;
  const tiff=await fromArrayBuffer(await mask.arrayBuffer()),image=await tiff.getImage();
  const width=image.getWidth(),height=image.getHeight();if(width*height>5000000)return null;
  const geo=image.getGeoKeys(),epsg=Number(geo.ProjectedCSTypeGeoKey??geo.GeographicTypeGeoKey);
  let projection:string;
  if(epsg>=32601&&epsg<=32660)projection=`+proj=utm +zone=${epsg-32600} +datum=WGS84 +units=m +no_defs`;
  else if(epsg>=32701&&epsg<=32760)projection=`+proj=utm +zone=${epsg-32700} +south +datum=WGS84 +units=m +no_defs`;
  else if(epsg===4326||epsg===3857)projection=`EPSG:${epsg}`;
  else return null;
  const [ox,oy]=image.getOrigin(),[rx,ry]=image.getResolution();
  if(![ox,oy,rx,ry].every(Number.isFinite))return null;
  const pixels=await image.readRasters({samples:[0],interleave:true});
  const values=Array.from(pixels as ArrayLike<number>,value=>value===1?1:0);
  const shapes=contours().size([width,height]).thresholds([0.5]).smooth(false)(values)[0];
  if(!shapes?.coordinates.length)return null;
  const coordinates=shapes.coordinates.map(polygon=>polygon.map(ring=>ring.map(([x,y])=>proj4(projection,'EPSG:4326',[ox+x*rx,oy+y*ry]))));
  const buildings=turf.multiPolygon(coordinates);
  const clipped=asAreaFeature(turf.intersect(turf.featureCollection([parcel,buildings])));
  if(!clipped||turf.area(clipped)<10)return null;
  return asAreaFeature(turf.rewind(turf.simplify(clipped,{tolerance:0.0000005,highQuality:true})));
 }catch{return null;}
}
