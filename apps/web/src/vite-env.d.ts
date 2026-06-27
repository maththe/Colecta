/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  /** URL do .pmtiles self-host (base suave Protomaps). Sem ela, o mapa usa OSM. */
  readonly VITE_PMTILES_URL?: string;
  /** Flavor de estilo do Protomaps (ex.: "light"). Padrão: "light". */
  readonly VITE_PMTILES_FLAVOR?: string;
  /** Chave do MapTiler para a base de satélite. Sem ela, cai no OSM. */
  readonly VITE_MAPTILER_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
