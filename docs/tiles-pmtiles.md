# Tiles do mapa — base suave self-host (Protomaps `.pmtiles`)

Tarefa de **infra da Fase 1** (pode ficar por último/à parte). Em **dev**, o front
cai no **OSM padrão** quando `VITE_PMTILES_URL` não está definida — nada a fazer
para desenvolver. Este documento descreve como gerar e servir o `.pmtiles` para
**produção**, fechando a decisão de tiles (Rev 4 do plano).

> **Por que self-host:** CARTO hosted e Esri World Imagery **não são livres** para
> produto comercial. `osm_muted` (base suave, default) = **Protomaps `.pmtiles`**
> self-host; `satellite` (secundário/adiável) = **MapTiler** com chave por env.

## Modos de base (`Site.baseMode`)
- `osm_muted` → camada **Protomaps** via `protomaps-leaflet`, lendo o `.pmtiles`
  apontado por `VITE_PMTILES_URL` (estilo claro via `VITE_PMTILES_FLAVOR`, padrão
  `light`). Sem a env → **OSM padrão** (dev).
- `satellite` → `TileLayer` **MapTiler** (`VITE_MAPTILER_KEY`). Sem a chave → OSM.
- `overlay` → placeholder (Fase 4).

A atribuição do provedor **+ OSM** acompanha sempre a camada renderizada.

## Pipeline de build do `.pmtiles`

Gera-se **um `.pmtiles` por região** (a bbox que cobre os recintos), não o planeta.
Versionar **o comando/script** aqui (não o arquivo `.pmtiles`, que mora no
bucket/volume).

1. **Extrato OSM regional** — baixar da [Geofabrik](https://download.geofabrik.de/)
   o `.osm.pbf` da região (ex.: um estado/país pequeno o suficiente).

2. **Recorte pela bbox dos sites** — para não carregar o extrato inteiro, recorte
   pela bbox que engloba os contornos (`Site.boundary`) com folga. Com
   [`osmium`](https://osmcode.org/osmium-tool/):
   ```bash
   # bbox = oeste,sul,leste,norte (graus). Use a bbox dos sites + padding.
   osmium extract -b -46.74,-23.66,-46.58,-23.52 regiao.osm.pbf -o recorte.osm.pbf
   ```

3. **Gerar o `.pmtiles`** com a [`pmtiles` CLI](https://github.com/protomaps/go-pmtiles)
   (via `tippecanoe`/`planetiler`, ou direto pelo build basemap do Protomaps):
   ```bash
   # Exemplo com planetiler (gera basemap padrão Protomaps a partir do .pbf):
   java -jar planetiler.jar --download=false --osm-path=recorte.osm.pbf \
     --output=recinto.pmtiles
   ```

4. **Publicar** `recinto.pmtiles` em bucket/volume servido por **HTTP range
   requests** e apontar `VITE_PMTILES_URL` para ele.

A atualização dos dados é **manual** (regerar o `.pmtiles`) — aceitável para
recinto fixo.

## Nota de deploy (nginx / Docker)

Verificado em `apps/web/nginx.conf` + `apps/web/Dockerfile`: o nginx já serve
estático com **range/`206`** (ok p/ pmtiles). Cuidados:

1. **Não gzipar** o `.pmtiles` — mantê-lo **fora de `gzip_types`** (o range
   request quebra com compressão on-the-fly).
2. **Não assar** o arquivo grande na imagem Docker — servir de **bucket/CDN com
   range** ou `location /tiles/` sobre **volume montado**, com
   `expires 1y` / `immutable`.
3. **CORS + header `Range`** apenas se a origem do `.pmtiles` **diferir** da do SPA.
