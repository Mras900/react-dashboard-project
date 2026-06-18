/// <reference types="vite/client" />

declare module 'shpjs' {
  import type { GeoJsonObject } from 'geojson';

  export default function shp(input: string | ArrayBuffer): Promise<GeoJsonObject | GeoJsonObject[]>;
}
