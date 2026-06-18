export type ComunaMetric = {
  comuna: string;
  visitas: number;
  ticketsUnicos: number;
  facturacion: number;
  alta: number;
  media: number;
  baja: number;
  reiteradas: number;
  lat: number;
  lng: number;
};

export const sourceSummary = {
  fileName: 'consolidado2026_limpio.xlsx',
  sheetName: 'Consolidado_Limpio',
  records: 486,
  comunas: 36,
  periodLabel: 'Enero - mayo 2026',
};

export const operationalSummary = {
  validVisits: 485,
  visitsUnder13Services: 429,
  visitsFrom13Services: 56,
  unsuccessfulVisits: 33,
};

export const monthlyFacturacion = [
  { label: 'Ene', value: 1722000 },
  { label: 'Feb', value: 1701000 },
  { label: 'Mar', value: 2516500 },
  { label: 'Abr', value: 2079000 },
  { label: 'May', value: 1527000 },
];

export const comunaMetrics: ComunaMetric[] = [
  { comuna: 'Puente Alto', visitas: 52, ticketsUnicos: 49, facturacion: 1025000, alta: 21, media: 30, baja: 1, reiteradas: 8, lat: -33.6117, lng: -70.5758 },
  { comuna: 'La Florida', visitas: 32, ticketsUnicos: 31, facturacion: 634500, alta: 14, media: 18, baja: 0, reiteradas: 2, lat: -33.5225, lng: -70.5981 },
  { comuna: 'Santiago', visitas: 31, ticketsUnicos: 30, facturacion: 561500, alta: 17, media: 14, baja: 0, reiteradas: 4, lat: -33.4489, lng: -70.6693 },
  { comuna: 'Quilicura', visitas: 30, ticketsUnicos: 29, facturacion: 619500, alta: 11, media: 19, baja: 0, reiteradas: 6, lat: -33.3577, lng: -70.7262 },
  { comuna: 'Maipú', visitas: 28, ticketsUnicos: 28, facturacion: 559000, alta: 14, media: 14, baja: 0, reiteradas: 0, lat: -33.5111, lng: -70.7587 },
  { comuna: 'San Bernardo', visitas: 28, ticketsUnicos: 26, facturacion: 546000, alta: 18, media: 9, baja: 1, reiteradas: 4, lat: -33.5922, lng: -70.6996 },
  { comuna: 'La Cisterna', visitas: 24, ticketsUnicos: 21, facturacion: 441500, alta: 8, media: 13, baja: 0, reiteradas: 6, lat: -33.5375, lng: -70.6653 },
  { comuna: 'Pudahuel', visitas: 20, ticketsUnicos: 20, facturacion: 404000, alta: 7, media: 13, baja: 0, reiteradas: 2, lat: -33.4436, lng: -70.7604 },
  { comuna: 'Peñalolén', visitas: 19, ticketsUnicos: 18, facturacion: 378000, alta: 11, media: 7, baja: 1, reiteradas: 2, lat: -33.4858, lng: -70.5333 },
  { comuna: 'Recoleta', visitas: 17, ticketsUnicos: 17, facturacion: 357000, alta: 7, media: 10, baja: 0, reiteradas: 4, lat: -33.4069, lng: -70.6394 },
  { comuna: 'Lo Prado', visitas: 16, ticketsUnicos: 15, facturacion: 286000, alta: 3, media: 13, baja: 0, reiteradas: 2, lat: -33.4442, lng: -70.7256 },
  { comuna: 'San Miguel', visitas: 13, ticketsUnicos: 10, facturacion: 241500, alta: 8, media: 4, baja: 1, reiteradas: 5, lat: -33.5008, lng: -70.6496 },
  { comuna: 'La Granja', visitas: 12, ticketsUnicos: 11, facturacion: 241500, alta: 6, media: 6, baja: 0, reiteradas: 2, lat: -33.5439, lng: -70.6257 },
  { comuna: 'La Pintana', visitas: 12, ticketsUnicos: 11, facturacion: 241500, alta: 9, media: 3, baja: 0, reiteradas: 2, lat: -33.5833, lng: -70.6342 },
  { comuna: 'Las Condes', visitas: 12, ticketsUnicos: 12, facturacion: 227000, alta: 5, media: 7, baja: 0, reiteradas: 2, lat: -33.4088, lng: -70.5671 },
  { comuna: 'Cerro Navia', visitas: 11, ticketsUnicos: 11, facturacion: 231000, alta: 6, media: 5, baja: 0, reiteradas: 0, lat: -33.4227, lng: -70.7354 },
  { comuna: 'El Bosque', visitas: 10, ticketsUnicos: 9, facturacion: 210000, alta: 3, media: 6, baja: 1, reiteradas: 2, lat: -33.5653, lng: -70.6751 },
  { comuna: 'Macul', visitas: 10, ticketsUnicos: 9, facturacion: 210000, alta: 4, media: 6, baja: 0, reiteradas: 2, lat: -33.4864, lng: -70.5997 },
  { comuna: 'San Joaquín', visitas: 10, ticketsUnicos: 10, facturacion: 210000, alta: 6, media: 4, baja: 0, reiteradas: 2, lat: -33.4961, lng: -70.6283 },
  { comuna: 'Estación Central', visitas: 9, ticketsUnicos: 9, facturacion: 174500, alta: 6, media: 3, baja: 0, reiteradas: 0, lat: -33.4591, lng: -70.6987 },
  { comuna: 'Quinta Normal', visitas: 9, ticketsUnicos: 9, facturacion: 174500, alta: 4, media: 5, baja: 0, reiteradas: 0, lat: -33.4289, lng: -70.6993 },
  { comuna: 'Renca', visitas: 9, ticketsUnicos: 9, facturacion: 178500, alta: 4, media: 5, baja: 0, reiteradas: 0, lat: -33.4034, lng: -70.7282 },
  { comuna: 'Vitacura', visitas: 8, ticketsUnicos: 8, facturacion: 153500, alta: 3, media: 5, baja: 0, reiteradas: 0, lat: -33.3814, lng: -70.5729 },
  { comuna: 'Independencia', visitas: 7, ticketsUnicos: 7, facturacion: 136500, alta: 2, media: 5, baja: 0, reiteradas: 0, lat: -33.4146, lng: -70.6653 },
  { comuna: 'Pedro Aguirre Cerda', visitas: 7, ticketsUnicos: 6, facturacion: 136500, alta: 3, media: 4, baja: 0, reiteradas: 2, lat: -33.4922, lng: -70.6764 },
  { comuna: 'Providencia', visitas: 7, ticketsUnicos: 7, facturacion: 136500, alta: 6, media: 1, baja: 0, reiteradas: 0, lat: -33.4314, lng: -70.6093 },
  { comuna: 'Cerrillos', visitas: 6, ticketsUnicos: 6, facturacion: 114000, alta: 3, media: 3, baja: 0, reiteradas: 0, lat: -33.5022, lng: -70.7167 },
  { comuna: 'Conchalí', visitas: 6, ticketsUnicos: 6, facturacion: 126000, alta: 1, media: 5, baja: 0, reiteradas: 0, lat: -33.3833, lng: -70.6756 },
  { comuna: 'La Reina', visitas: 6, ticketsUnicos: 6, facturacion: 126000, alta: 3, media: 2, baja: 1, reiteradas: 0, lat: -33.4489, lng: -70.5511 },
  { comuna: 'Ñuñoa', visitas: 6, ticketsUnicos: 6, facturacion: 122000, alta: 4, media: 2, baja: 0, reiteradas: 2, lat: -33.4569, lng: -70.5975 },
  { comuna: 'Lo Espejo', visitas: 5, ticketsUnicos: 5, facturacion: 101000, alta: 1, media: 4, baja: 0, reiteradas: 0, lat: -33.5208, lng: -70.6914 },
  { comuna: 'Huechuraba', visitas: 4, ticketsUnicos: 4, facturacion: 84000, alta: 3, media: 1, baja: 0, reiteradas: 0, lat: -33.3675, lng: -70.6428 },
  { comuna: 'San Ramón', visitas: 3, ticketsUnicos: 3, facturacion: 52500, alta: 2, media: 1, baja: 0, reiteradas: 0, lat: -33.5371, lng: -70.6414 },
  { comuna: 'Lampa', visitas: 2, ticketsUnicos: 2, facturacion: 42000, alta: 1, media: 1, baja: 0, reiteradas: 0, lat: -33.2863, lng: -70.8756 },
  { comuna: 'Lo Barnechea', visitas: 2, ticketsUnicos: 2, facturacion: 21000, alta: 1, media: 1, baja: 0, reiteradas: 0, lat: -33.3527, lng: -70.5177 },
  { comuna: 'Padre Hurtado', visitas: 2, ticketsUnicos: 2, facturacion: 42000, alta: 1, media: 1, baja: 0, reiteradas: 0, lat: -33.5672, lng: -70.8339 },
];
