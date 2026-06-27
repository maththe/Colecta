# Plano de implementação — Recinto (Site) + Zonas + Tempo real + Overlay

> **Onde este arquivo será salvo:** ao aprovar o plano, ele é gravado em
> `docs/plano-recinto.md` (a pasta `docs/` será criada). Durante o plan mode só é
> possível editar o arquivo de plano do harness; o conteúdo abaixo é o definitivo.
>
> **Revisão 2** — incorpora as 9 correções de revisão (belonging persistido e
> simétrico Site/Zone; `siteId` obrigatório; editor de polígono na Fase 1; storage
> real p/ overlay; máscara via Turf; interação cluster×polling; tileset Positron;
> polling sem atalho; Task com `siteId`).
>
> **Revisão 3** — invariante de belonging indoor (bin/câmera com `locationId`
> herdam `location.siteId`, sem Turf nem divergência); resolução de `siteId` num
> único ponto (`geo.util.resolveSiteId`) chamado por TODO writer (incl.
> `upsertAutoTask` e `seed.ts`) + ordem explícita da migration; **tiles CARTO/Esri
> trocados** por violarem termos comerciais (decisão self-host vs chave em aberto);
> QF-B com **assinatura MQTT única** (sem ingestão duplicada) + índice único parcial.
>
> **Revisão 4** — fecha o Ajuste 3 (tiles): `osm_muted` = **self-host Protomaps
> `.pmtiles`** (lib `protomaps-leaflet`, build via Geofabrik → `pmtiles` CLI como
> tarefa de infra da Fase 1); `satellite` = **MapTiler** (chave/env, adiável).
> Inclui nota de deploy (range requests no nginx, sem gzip, bucket/volume, CORS).

---

## 🆕 O que mudou na Revisão 3 (resumo)

1. **Invariante indoor (Fase 1):** bin/câmera **com `locationId` herdam
   `location.siteId`** — não resolvem por Turf nem aceitam `siteId` divergente do
   payload (erro claro). Só outdoor (sem `locationId`) resolve por coord
   (FK→Turf→default). Reatribuir o Site de uma `Location` **cascateia** em transação
   para suas lixeiras e câmeras.
2. **Resolução de `siteId` transversal (Fase 1):** um único `geo.util.resolveSiteId`
   chamado por **todos** os writers de recurso espacial (controllers,
   `tasks.service.upsertAutoTask`, `seed.ts`, criações internas). Ordem da migration
   tornada explícita (location/bin/camera **antes** de task).
3. **Provedor de tiles (Fase 1) — DECIDIDO (Rev 4):** CARTO hosted e Esri World
   Imagery saem (não-livres p/ comercial). `osm_muted` = **self-host Protomaps**
   (`.pmtiles` por região, estilo claro tipo Positron, `protomaps-leaflet` no front);
   `satellite` = **MapTiler Satellite** (com chave/env, secundário, adiável).
   Detalhes na seção de decisão abaixo.
4. **QF-B (MQTT):** **uma única assinatura** (`binovate/medidas/#`) com ramificação
   no handler — elimina a ingestão duplicada do tópico-pai. Índice **único parcial**
   em `mqtt_topic` via SQL cru na migration.

### ✅ Decisão de tiles (Rev 4 — fecha o Ajuste 3)
- **`osm_muted` (default) — self-host Protomaps:** um **`.pmtiles` por região**
  (extrato OSM da **bbox dos sites**, não o planeta), servido por **HTTP range
  requests** (bucket estático **ou** o próprio Nest/nginx). Estilo claro tipo
  Positron (estilo aberto CARTO BSD ou o *light style* do Protomaps). Consumo no
  front via **`protomaps-leaflet`**. Atualização de dados é **manual** (re-gerar o
  `.pmtiles`) — aceitável para recinto fixo.
- **`satellite` (secundário) — NÃO self-host:** **MapTiler Satellite** (termos
  comerciais claros), **chave por env + atribuição**. **Adiável** se o escopo da
  Fase 1 apertar.
- **`overlay` (Fase 4):** inalterado (mapa do dono em storage real).
- **Build do `.pmtiles` (tarefa de INFRA da Fase 1):** Geofabrik (extrato regional)
  → recorte pela bbox dos sites → **`pmtiles` CLI** gera o arquivo. Versionar o
  comando/script (não o arquivo) no repo; o `.pmtiles` mora em bucket/volume.
- **Nota de deploy (verificado no `apps/web/nginx.conf` + `apps/web/Dockerfile`):**
  o nginx 1.27 já serve estático com **range/`206`** (ok p/ pmtiles). Cuidados:
  (1) **não gzipar** o `.pmtiles` (manter fora de `gzip_types`); (2) **não assar** o
  arquivo grande na imagem Docker — servir de **bucket/CDN com range** ou
  `location /tiles/` sobre **volume montado**, com `expires 1y`/`immutable`;
  (3) **CORS + header `Range`** só se a origem do `.pmtiles` diferir da do SPA.

> ⚠️ **Divergências verificadas no código (Rev 3):**
> - **Auto-tarefas SEMPRE têm bin:** `automation.service.evaluateBin` (linhas 15-23)
>   exige `bin` e chama `tasks.upsertAutoTask({ tenantUuid, bin, issues })`. Logo a
>   auto-tarefa **herda `bin.siteId`** — não "cai no Site default". O writer a
>   ajustar é **`tasks.service.upsertAutoTask`**.
> - **Índice único parcial não é modelável no Prisma schema:** hoje há
>   `@@index([tenantUuid, mqttTopic])` **não-único**. O único parcial (`WHERE
>   mqtt_topic IS NOT NULL`) vai como **SQL cru na migration**; o Prisma não o
>   reflete no schema, mas o Postgres o aplica.
> - **`resolveMqttTrashBin`** (`sensor-readings.service.ts:150-178`) já casa por
>   `mqttTopic: topic` (igualdade do tópico inteiro) — basta guardar o tópico
>   completo em `mqttTopic` e parar de passar `trashBinCode/Id` por env.

---

## Context (por que esta mudança)

O Colecta mira **grandes áreas** (parques, zoológicos, parques de diversões,
campos), onde a maioria das lixeiras fica **ao ar livre, ao longo de caminhos** —
não dentro de prédios. Hoje o sistema modela `Location` como **construção (prédio
com andares)** e não tem o conceito do **recinto** como objeto espacial de topo.
Faltam: contorno da área, máscara/limites do mapa, zonas temáticas, e o mapa
reflete telemetria só com reload. Este plano introduz **Site** (recinto) e
**Zone**, aposenta o `spreadBins()` para outdoor, adiciona clustering, polling e
overlay do mapa do dono — reusando o máximo do que já existe.

---

## ⚠️ Divergências encontradas entre as premissas e o código real

1. **"Lixeiras ao ar livre herdam a lat/lng do prédio" — JÁ NÃO É VERDADE.**
   Migrations `20260528171500_split_locations_from_trash_bins` e
   `20260625120000_drop_isolated_locations` já dividiram o schema. Em
   `apps/api/prisma/schema.prisma`, `TrashBin.latitude/longitude` são coordenadas
   **próprias** da lixeira outdoor. Em `trash-bins.service.ts → toResponse()`
   (linhas 167-180), o fallback para a coord da `location` só ocorre quando
   `bin.latitude` é `null` (lixeira **indoor**). Outdoor já tem coord real.

2. **`spreadBins()` hoje DISTORCE a posição.** Em `map-markers.ts` (linhas 86-113),
   aplicado a `bins.filter((bin) => !bin.location)` (outdoor) em `TrashBinMap.tsx:203`,
   desloca **toda** lixeira ~18 m da coordenada real — mesmo havendo uma só. Como
   outdoor já tem coord real, é **bug de precisão**: aposentá-lo corrige posições.

3. **NÃO existe React Query / SWR.** Padrão = hook próprio `useAsyncData`
   (`apps/web/src/hooks/useAsyncData.ts`) + `useState/useEffect` manual no mapa
   (`MapPage.tsx:81-136`). **Decisão:** estender `useAsyncData` com
   `refetchIntervalMs`.

4. **Sem `react-leaflet-cluster`/`leaflet.markercluster`, sem editor de polígono,
   sem `Leaflet.ImageOverlay.Rotated`** nas deps — adicionados nas fases.
   `react-leaflet@4.2.1` + `leaflet@1.9.4` são compatíveis com
   `react-leaflet-cluster@2.x` e com `@geoman-io/leaflet-geoman-free`.

5. **Overlay indoor reusável existe** em `BuildingViewPage.tsx → FloorPlanMap`
   (linhas 793-1001): `L.CRS.Simple` + `ImageOverlay` com bounds em pixels — base do
   overlay geográfico da Fase 4.

6. **Câmeras e Tarefas têm o MESMO padrão dual de posição** que a lixeira
   (`latitude/longitude` + `floor/posX/posY`). Logo `siteId` aplica-se às quatro
   entidades (ver decisão nº 9 da revisão).

7. **MQTT amarrado a UMA lixeira por env** (`mqtt-ingest.service.ts`:
   `DEFAULT_TRASH_BIN_CODE='PRQ-001'`/`MQTT_TRASH_BIN_ID`, tópico único
   `binovate/medidas`).

8. **`JWT_SECRET` com fallback hardcoded em DOIS lugares:**
   `auth.module.ts:11` e `auth.guard.ts:46` (`|| 'chave_super_secreta_aqui'`).

9. **Projeção:** o mapa principal usa Web Mercator (EPSG:3857), válido só até
   **≈ ±85,05°**. Qualquer máscara baseada no globo literal `±90` projeta para o
   infinito → recorte torto. A revisão trata isso (nº 5 abaixo).

---

## ✅ Decisões (confirmadas + ajustadas na revisão)

- **Belonging é FK persistida, geometria só sugere — para Site E Zone (simétrico).**
  - `siteId` e `zoneId` são a **fonte da verdade**; Turf (`point-in-polygon`)
    apenas **sugere/recalcula**, nunca substitui a coluna.
- **Invariante de belonging INDOOR (Rev 3):** recurso **com `locationId`**
  (bin/câmera dentro de um prédio) **herda `location.siteId`** — fonte única para
  indoor. O writer **não** resolve por Turf (não há coord própria) e **rejeita com
  erro** um `siteId` divergente no payload. Só **outdoor** (sem `locationId`)
  resolve pela coord (FK→Turf→default). **Reatribuir o Site de uma `Location`
  cascateia** (transação) para todas as suas lixeiras e câmeras.
- **Resolução de `siteId` num único ponto (Rev 3):** `geo.util.resolveSiteId`
  chamado por **todo** writer de recurso espacial (controllers,
  `tasks.service.upsertAutoTask`, `seed.ts`, criações internas) — `NOT NULL` é
  invariante transversal, não responsabilidade só do DTO.
- **`siteId` é OBRIGATÓRIO:** `NOT NULL` + `onDelete: Restrict` em `Location`,
  `TrashBin`, `Camera` **e `Task`** (simetria — divergência nº 6). Não se apaga um
  Site com recursos vinculados; força reatribuir antes. "Pertencer a um recinto é
  obrigatório" → sem órfãos.
- **`zoneId` é OPCIONAL** (`NULL` permitido) — zonas não cobrem todo o Site;
  `onDelete: SetNull`. Recomputado via Turf quando a lixeira move ou a zona muda;
  admin pode sobrescrever (espelha a regra do Site).
- **Polling:** estender `useAsyncData` com `refetchIntervalMs` (sem React Query,
  sem `setInterval` solto por tela).
- **Máscara:** gerada por `@turf/turf` `mask()` sobre um **bbox do Site com padding**
  (dentro de ±85°), não desenhada à mão nem com o globo `±90`.
- **`baseMode` (Rev 3 — tiles trocados por termos comerciais):** a arquitetura de
  modos não muda, só a fonte. `osm_muted` = base "suave" sem clutter (não grayscale
  por CSS); `satellite` = imagem de satélite. **CARTO hosted e Esri World Imagery
  ficam proibidos** (não-livres p/ produto comercial). Fonte definida pela pergunta
  aberta nº 3 (self-host vs provedor com chave). **Atribuição do provedor + OSM
  obrigatória** no controle do Leaflet; **chave de tiles por env**, nada hardcoded.
  É **pré-requisito de shippar a Fase 1 em produção**.
- **Overlay do dono (Fase 4):** imagem em **storage real** (disco/MinIO/S3 + URL),
  não data URL no banco.
- **Editor de polígono (`leaflet-geoman`) entra na Fase 1** (desenhar boundary) e é
  reusado na Fase 2 (zonas).

### ❓ Perguntas em aberto (não bloqueiam a Fase 1)
1. **Multi-site na UI v1:** schema é multi-site; UI v1 fixa no **Site default por
   tenant** (seletor de Site fica para depois) — confirmar.
2. **Backend de storage do overlay (Fase 4):** disco local servido pelo Nest, MinIO
   ou S3? (Plano: abstração `StorageService` com impl. disco/MinIO por env.)
3. **Identificador de device MQTT (QF-B):** reusar `TrashBin.mqttTopic` como chave do
   sufixo do tópico (sem migration) ou coluna `deviceId` dedicada? (Plano: reusar.)
4. ~~**Fonte de tiles**~~ — **RESOLVIDO (Rev 4):** self-host Protomaps `.pmtiles`
   (`osm_muted`) + MapTiler Satellite com chave (`satellite`, adiável). Ver "Decisão
   de tiles". (Dev começa a Fase 1 com OSM padrão; trocar antes de shippar.)
5. **Rotação do overlay:** axis-aligned primeiro; rotação (`ImageOverlay.Rotated`)
   como incremento na mesma fase — confirmar se entra já.

---

## Ordem e paralelização

> **▶️ Sequência de arranque aprovada pelo usuário:** começar pelos **quick-fixes
> QF-A (JWT — risco vivo) e QF-B (MQTT)**, que são pequenos e independentes; **depois
> a Fase 1 inteira** (o coração, que destrava Fases 2–4). Fases 2/3/4 ficam para
> rodadas seguintes.

```
Quick-fixes (QF-A JWT, QF-B MQTT)  ── independentes, a qualquer momento
        │
Fase 1 (Site + boundary + EDITOR geoman + máscara turf + maxBounds + cluster
        + baseMode Positron/Esri + aposentar spreadBins + siteId obrigatório)
        │   └── base das demais (cria Site e siteId)
        ├──> Fase 2 (Zone + zoneId persistido + analytics por zona)
        ├──> Fase 3 (polling via useAsyncData — testar COM cluster)
        └──> Fase 4 (overlay do dono em storage real / satélite)
```

- **Fase 1 é pré-requisito** das Fases 2 e 4.
- **Fase 3 é independente**, mas tem **interação com a Fase 1** (cluster × re-render):
  se as duas convivem, validar juntas (ver nota cruzada na Fase 3).
- **QF-A/QF-B** não dependem de nada. **Fases 2 e 4** são independentes entre si.

---

## Fase 1 — Site (recinto): contorno editável, máscara, maxBounds, cluster, baseMode

**Objetivo:** criar o recinto como container espacial obrigatório, **com UI para
desenhar o contorno**, recortar o mapa, agrupar marcadores e aposentar o
`spreadBins()`. (Sem o editor, a fase não entrega máscara/maxBounds ao dono — só
affordance de dev; por isso o editor é parte da fase, não incremento.)

### Schema (`apps/api/prisma/schema.prisma`)
- **Novo model `Site`:**
  ```
  model Site {
    id          String  @id @default(uuid()) @db.Uuid
    tenantUuid  String
    name        String
    boundary    Json?        // GeoJSON Polygon/MultiPolygon (sem PostGIS)
    baseMode    SiteBaseMode @default(osm_muted)
    centerLat   Float?
    centerLng   Float?
    defaultZoom Int?
    createdAt   DateTime @default(now())
    updatedAt   DateTime @updatedAt
    locations   Location[]
    trashBins   TrashBin[]
    cameras     Camera[]
    tasks       Task[]
    @@index([tenantUuid])
    @@map("sites")
  }
  enum SiteBaseMode { osm_muted  satellite  overlay }
  ```
- **`siteId String @db.Uuid` (NOT NULL) + `site Site @relation(..., onDelete: Restrict)`**
  em `Location`, `TrashBin`, `Camera` **e `Task`**. `@@index([siteId])` em cada.
- **Migration:** `20260626xxxxxx_add_sites` (multi-passo, para satisfazer NOT NULL):
  1. cria `sites` + enum;
  2. cria **1 Site default por `tenantUuid` distinto** (`INSERT ... SELECT DISTINCT
     tenantUuid FROM ...`), `boundary = null`;
  3. adiciona `siteId` **nullable** e faz o backfill **em ordem explícita** (a
     cadeia da task lê `trashBin.siteId`/`location.siteId` já preenchidos):
     - **(c.1)** `UPDATE locations` → Site default do tenant;
     - **(c.2)** `UPDATE trash_bins`/`cameras`: **se `locationId` presente, herdar
       `location.siteId`** (invariante indoor); senão, Site default do tenant
       (na migration não há Turf — todo mundo cai no único Site default do tenant);
     - **(c.3)** `UPDATE tasks` (DEPOIS de c.1/c.2) pela cadeia
       `trashBin.siteId` → `location.siteId` → `camera.siteId` → Site default;
  4. `ALTER COLUMN siteId SET NOT NULL` + FK `Restrict` nas 4 tabelas.
- **Impacto:** todo recurso existente passa a ter Site; `boundary = null` →
  front trata como "sem recorte" até o dono desenhar (mas o editor já existe na
  fase, então é desenhável imediatamente). `centerLat/Lng/defaultZoom` podem ficar
  `null` (front mantém o cálculo atual de `MapPage.center:161-190`).

### Backend (Nest)
- **Módulo** `apps/api/src/sites/` (espelha `locations.*`): module/controller/service
  + `dto/create-site.dto.ts`, `dto/update-site.dto.ts`. Endpoints `GET /sites`,
  `GET /sites/:id`, `POST`, `PATCH`, `DELETE` (escrita `@Roles(ADMIN)`; guards globais
  reusados). Registrar em `app.module.ts`.
- **DTO `boundary`:** validação leve de GeoJSON (`type`/`coordinates`), no molde de
  `assertValidFloorPlans` (`locations.service.ts:129`).
- **`apps/api/src/common/geo.util.ts` (novo) — ponto único de resolução:**
  `resolveSiteId(input)` aplica a regra:
  - **indoor** (`locationId` presente): retorna `location.siteId`; se o payload
    trouxe `siteId` divergente, **lança `BadRequestException`** (não silencia).
  - **outdoor** (sem `locationId`): cadeia `siteId` explícito → Turf
    (`@turf/boolean-point-in-polygon` sobre os boundaries do tenant) → Site default.
  - **sem coord nem pai** (ex.: ocorrência de câmera sem posição): Site default.
  Helpers de point-in-polygon ficam aqui (reusados pela Fase 2 e pelo QF-B).
- **Chamado por TODOS os writers** (invariante transversal, não só DTO):
  `trash-bins.service` (create/update), `cameras.service`, `locations.service`,
  `tasks.service` (create **e `upsertAutoTask`** — a auto-tarefa herda `bin.siteId`,
  ver divergência verificada acima), e `prisma/seed.ts` (todo registro semeado).
- **Cascata ao reatribuir Site de uma `Location`** (`locations.service.update`):
  numa transação, ao mudar `location.siteId`, atualizar `siteId` de todas as
  `trashBins`/`cameras` com aquele `locationId`. Documentar inline + nota de teste.
- **DTOs de bin/location/camera/task:** `siteId?` opcional (validado, mas a verdade
  é a regra acima — divergência indoor vira erro; a coluna nunca fica nula).

### Front
- **Tipos/API:** `apps/web/src/modules/sites/{types.ts,api/sites.api.ts}` + registrar
  em `apps/web/src/lib/api/index.ts`; adicionar `siteId` aos types de
  `Location`/`TrashBin`/`SecurityCamera`/`Task`.
- **`TrashBinMap.tsx`:**
  - Prop `site: Site`.
  - **Máscara via Turf:** `mask(boundary, bboxPolygonComPadding)` (Turf) gera o
    polígono "fora-do-recinto" já com winding correto; renderizar como `Polygon`
    semi-opaco. O anel externo é o **bbox do Site com padding** (válido em Mercator),
    nunca `±90`. Sem `boundary` → sem máscara.
  - **`maxBounds`** = bbox do boundary + padding, com `maxBoundsViscosity < 1`.
  - **`baseMode` (Rev 4 — fonte decidida):** `osm_muted` → camada **Protomaps** via
    `protomaps-leaflet`, apontando para o `.pmtiles` regional (URL do bucket/volume),
    estilo claro tipo Positron; `satellite` → `TileLayer` **MapTiler Satellite**
    (chave por env, adiável); `overlay` → placeholder p/ Fase 4. Atribuição
    Protomaps/MapTiler **+ OSM** sempre no controle de atribuição. Em dev sem
    `.pmtiles` pronto, cair para OSM padrão.
  - **Cluster:** envolver os `Marker` de lixeiras em `MarkerClusterGroup`
    (`react-leaflet-cluster`), com **`key={bin.id}` estável** em cada `Marker`
    (preparando a convivência com o polling da Fase 3).
  - **Aposentar `spreadBins()`:** renderizar outdoor em `[bin.latitude, bin.longitude]`
    (remover o uso de `spreadBins` em `:203`); remover/depreciar a função em
    `map-markers.ts` (manter `buildMarkerIcon`/cores/ícones).
- **Editor de contorno (geoman):** componente que ativa `@geoman-io/leaflet-geoman-free`
  no `MapContainer` para desenhar/editar o `boundary` (Polygon), salvando via
  `PATCH /sites/:id`. Modo de edição restrito a `ADMIN`. Também usado p/ definir
  `centerLat/Lng/defaultZoom` (botão "usar visão atual").
- **`MapPage.tsx`:** carregar o Site default (`api.sites.list()`), passar ao
  `TrashBinMap`; usar `center/zoom` do Site quando houver.

### Dependências
- libs front: `react-leaflet-cluster` + `leaflet.markercluster`,
  `@geoman-io/leaflet-geoman-free`, **`protomaps-leaflet`** (substitui a lib de
  provedor que entraria de qualquer modo).
- libs back: `@turf/turf` (ou `mask` + `boolean-point-in-polygon` avulsos; usado
  também no front p/ a máscara).
- **Infra:** pipeline de build do `.pmtiles` (Geofabrik → `pmtiles` CLI, recorte
  pela bbox dos sites) — ver "Decisão de tiles" acima. `.pmtiles` em bucket/volume
  com range requests (não na imagem Docker). `satellite` exige chave MapTiler (env).
- Sem dependência de outras fases.

### Riscos e mitigação
- **Backfill NOT NULL:** ordem das etapas da migration é crítica (Site antes do
  `SET NOT NULL`); cobrir tasks sem coordenada pela cadeia de resolução.
- **Projeção/máscara:** usar Turf `mask()` + bbox padded resolve o ±90 e o winding.
- **cluster + DivIcon:** validar agrupamento e popups dentro do cluster.
- **`Restrict` ao apagar Site:** front deve oferecer "reatribuir recursos" antes de
  deletar; tratar `P2003` com mensagem clara (como `locations.service.ts:188`).

### Pronto / como testar
- Migration aplica em banco com dados; **todo** recurso fica com `siteId` (SQL/Studio).
- No `/map`, o **ADMIN desenha o contorno** (geoman) e salva; o mapa passa a exibir
  **máscara**, **pan limitado** (maxBounds) e **clusters**; outdoor na coord exata.
- Trocar `baseMode` alterna base suave ↔ satélite (fonte da decisão nº 3; em dev,
  OSM padrão).
- Bin/câmera **indoor**: editar seu Site direto → erro (herda `location.siteId`);
  mudar o Site da `Location` → lixeiras/câmeras daquele prédio cascateiam (Studio/SQL).
- Tentar apagar Site com lixeiras → bloqueado com mensagem.
- `pnpm db:migrate && pnpm db:seed && pnpm dev` → `/map`.

### Esforço: **G**

---

## Fase 2 — Zone (zonas temáticas): polígonos, `zoneId` persistido, analytics por zona

**Objetivo:** subdividir o Site em zonas (GeoJSON) com cor/categoria, exibi-las e
quebrar métricas/roteamento por zona — com **belonging estável** igual ao Site.

### Schema
- **Novo model `Zone`:**
  ```
  model Zone {
    id         String @id @default(uuid()) @db.Uuid
    tenantUuid String
    siteId     String @db.Uuid
    site       Site   @relation(fields: [siteId], references: [id], onDelete: Cascade)
    name       String
    category   String?
    color      String?
    polygon    Json
    createdAt  DateTime @default(now())
    updatedAt  DateTime @updatedAt
    trashBins  TrashBin[]
    @@index([tenantUuid]) @@index([siteId])
    @@map("zones")
  }
  ```
- **`zoneId String? @db.Uuid` + `zone Zone? @relation(..., onDelete: SetNull)`** em
  `TrashBin` (nullable: pode estar fora de qualquer zona). `@@index([zoneId])`.
  (Câmera/Task podem ganhar `zoneId` depois, por simetria, se o analytics pedir.)
- **Migration:** `20260627xxxxxx_add_zones`. Sem impacto (tabela/coluna novas;
  `zoneId` nasce nulo e é populado pelo recálculo).

### Belonging (mesma filosofia do Site)
- `zoneId` **persistido** = fonte da verdade para analytics/roteamento.
- **Recalculado via Turf** quando: (a) a lixeira muda de `latitude/longitude`
  (create/update em `trash-bins.service.ts`), ou (b) uma zona é criada/editada/movida
  (recomputa as lixeiras do Site afetado). Admin pode **sobrescrever** manualmente.
- Reusa `geo.util.ts` (Fase 1): `resolveZoneId(coord, zonesDoSite)`.

### Backend
- **Módulo** `apps/api/src/zones/` (CRUD como `sites/`), `GET/POST/PATCH/DELETE
  /zones?siteId=`. Após escrita de zona, disparar o recálculo de `zoneId` das
  lixeiras do Site. Registrar em `app.module.ts`.
- **Analytics:** estender `analytics.service.ts`/`controller.ts` com agrupamento por
  zona (`GET /analytics/bins?groupBy=zone`) usando o **`zoneId` persistido** (não
  recalcula a cada request).

### Front
- **Tipos/API:** `apps/web/src/modules/zones/{types.ts,api/zones.api.ts}`.
- **`TrashBinMap.tsx`:** `Polygon` por zona (cor translúcida, abaixo dos markers) +
  label/popup; toggle via `FilterChips`. **Editor de zona reusa o geoman** da Fase 1.
- **Analytics:** seção "por zona" em `AnalyticsPage.tsx` (reusa `recharts`).

### Dependências
- Depende da **Fase 1** (`Site`/`siteId`/geoman/`geo.util`). Sem libs novas.

### Riscos e mitigação
- **Polígonos sobrepostos:** regra de desempate determinística (ordem/prioridade)
  documentada; o recálculo aplica a mesma regra.
- **Custo do recálculo** ao editar zona: recomputar só as lixeiras do Site; ok p/ MVP.

### Pronto / como testar
- Criar 2 zonas (desenhando com geoman); lixeiras recebem `zoneId` coerente (Studio).
- Mover uma lixeira entre zonas (editar lat/lng) → `zoneId` recalcula.
- Editar o polígono de uma zona → lixeiras afetadas recalculam.
- `GET /analytics/bins?groupBy=zone` bate com as posições reais.

### Esforço: **M**

---

## Fase 3 — Tempo real v1: polling no cliente (sem reload)

**Objetivo:** refletir `fillLevel`/`status`/`batteryLevel` sem recarregar.
**Independente em schema**, mas com **interação conhecida com a Fase 1 (cluster)**.

### Backend
- **Sem schema novo.** Reusar `GET /trash-bins` e `GET /tasks/map`.

### Front
- **Estender `useAsyncData`** (`apps/web/src/hooks/useAsyncData.ts`) com
  `refetchIntervalMs?`: `setInterval` chamando `reload()`, **pausando em aba oculta**
  (`document.visibilityState`) e limpando no unmount; mantém `refreshing`.
  **Este é o único mecanismo** — nada de `setInterval` ad-hoc por tela (evita
  reinventar os mesmos bugs em cada página).
- **`MapPage.tsx`:** migrar o carregamento dos marcadores para o `useAsyncData`
  estendido, atualizando via `setData` **sem remontar `MapContainer`**.
- **Convivência com o cluster (Fase 1):** com `MarkerClusterGroup`, cada poll
  re-renderiza os `Marker`; sem cuidado, o cluster recalcula, **pisca e fecha popup
  aberto**. Conserto (react-leaflet, não Leaflet puro): **`key={bin.id}` estável**
  (já previsto na Fase 1) para o React **não remontar** os marcadores, e **não trocar
  props do `MapContainer`** entre renders. **Testar explicitamente com o cluster
  ligado.**

### Dependências
- Nenhuma lib nova. Se rodar junto/depois da Fase 1, validar com cluster.

### Riscos e mitigação
- **Flicker/popup fechando:** keys estáveis + `setData` preservando seleção/popup.
- **Carga no servidor:** intervalo conservador (15–30 s), pausa em aba oculta.

### Pronto / como testar
- Publicar leitura MQTT (ou `POST /sensor-readings`) mudando `fillLevel`; o marcador
  atualiza sozinho **com o cluster ligado**, sem reload e sem fechar popup aberto.

### Esforço: **P/M**

---

## Fase 4 — Overlay do mapa do dono (storage real) e/ou satélite

**Objetivo:** "mapa do dono" (planta/ilustração da área) sobreposto no CRS
geográfico via `baseMode = overlay`; e/ou base satélite. **A imagem do recinto é o
maior e mais requisitado asset do sistema** — por isso vai para **storage real**, não
base64 no banco (evita inchar toda resposta de `GET /sites` e o cap rejeitar mapas
legítimos).

### Schema
- **Reusa `Site.baseMode`.** Adiciona ao `Site`: `overlayUrl String?` (URL no
  storage), `overlayBounds Json?` (`[[swLat,swLng],[neLat,neLng]]`),
  `overlayRotation Float?` (ou 3 cantos, se Rotated).
- **Migration:** `20260628xxxxxx_add_site_overlay` (colunas nullable; sem impacto).

### Backend
- **`StorageService` (novo, abstração):** impl. disco local (servido pelo Nest) ou
  MinIO/S3 por env (ver pergunta aberta nº 2). **`POST /sites/:id/overlay`**
  (multipart) grava no storage e devolve `overlayUrl`; `GET /sites` retorna **só a
  URL** (nunca o binário/base64).
- DTOs de Site aceitam `overlayBounds`/`overlayRotation` (validação leve).

### Front
- **`TrashBinMap.tsx`:** `baseMode === 'overlay'` + `overlayUrl`/`overlayBounds` →
  **`ImageOverlay`** (mesmo componente de `BuildingViewPage.tsx:869`, agora com
  `LatLngBounds` geográfico). `satellite` → Esri. Rotação (opcional):
  `Leaflet.ImageOverlay.Rotated`; v1 pode ser **axis-aligned**.
- **Georreferência:** UI mínima (arrastar 2 cantos / colar bounds), reusando o
  upload de imagem já existente nas plantas indoor — mas enviando ao endpoint de
  storage, não embutindo data URL.

### Dependências
- Depende da **Fase 1** (`Site`/`baseMode`). Reusa `ImageOverlay` indoor.
- libs: `Leaflet.ImageOverlay.Rotated` só se rotação entrar nesta fase; cliente de
  storage (MinIO/S3) conforme decisão.

### Riscos e mitigação
- **Georreferência imprecisa:** começar axis-aligned (2 cantos); rotação incremental.
- **Asset pesado:** storage real + URL resolve; servir com cache/headers adequados.

### Pronto / como testar
- Subir imagem do parque, definir bounds, `baseMode = overlay` → imagem alinhada ao
  recinto com marcadores por cima; `GET /sites` continua leve (só URL). Trocar p/
  `satellite` mostra base de satélite.

### Esforço: **M/G** (G com rotação + editor de cantos + storage).

---

## Correções rápidas paralelas

### QF-A — `JWT_SECRET` sem fallback
- **Arquivos:** `auth.module.ts:11`, `auth.guard.ts:46`.
- **Mudança:** ler via `ConfigService`/`process.env`; **falhar o boot** se ausente;
  remover o literal. Atualizar `apps/api/.env.example`. **Esforço: P.**
- **Pronto:** sem env → boot falha com mensagem clara; com env → login OK.

### QF-B — MQTT por device
- **Arquivos:** `mqtt-ingest.service.ts`,
  `sensor-readings.service.ts` (`resolveMqttTrashBin`, linhas 150-178).
- **Assinatura ÚNICA (Rev 3 — evita ingestão duplicada):** assinar **só**
  `binovate/medidas/#` (não manter `binovate/medidas` em paralelo — `#` casa também o
  tópico-pai, que a assinatura legada também casaria → mensagem processada 2×).
  Ramificar **no handler**: com sufixo `{deviceId}` → resolver a lixeira por
  `TrashBin.mqttTopic` (igualdade do tópico completo — `resolveMqttTrashBin` já faz
  isso); sem sufixo (tópico-pai exato) → caminho legado (bin default por env), se
  ainda quiser compat. Parar de injetar `MQTT_TRASH_BIN_CODE/ID` por padrão.
- **Índice único PARCIAL (requer migration):** `CREATE UNIQUE INDEX ... ON trash_bins
  (tenant_uuid, mqtt_topic) WHERE mqtt_topic IS NOT NULL` — **SQL cru** na migration
  (o Prisma não modela único parcial; hoje há só `@@index([tenantUuid, mqttTopic])`
  não-único). Unicidade garantida no banco, não só na prosa. Migration
  `20260626xxxxxx_unique_mqtt_topic`.
- **Esforço: M.**
- **Pronto:** publicar em `binovate/medidas/PRQ-002` grava na lixeira de
  `mqttTopic = 'binovate/medidas/PRQ-002'`; **uma** leitura por mensagem (sem
  duplicação); dois bins com o mesmo `mqttTopic` no tenant → erro de unicidade.

---

## Reuso explícito (não reescrever)
- `buildMarkerIcon` + cores/ícones (`map-markers.ts`) — manter; só remover `spreadBins`.
- `ImageOverlay`/`FloorPlanMap` (`BuildingViewPage.tsx`) — base do overlay da Fase 4.
- Padrão de módulo Nest (`locations.*` + DTOs class-validator) — molde de `sites/`/`zones/`.
- `tenantUuid` + guards/roles globais — aplicar aos novos módulos.
- `useAsyncData` — **estendido** (não substituído) para polling.
- `assertValidFloorPlans` (`locations.service.ts:129`) — molde de validação de `Json`.
- `geo.util.ts` (Fase 1) — reusado pela Fase 2 (zonas) e pelo MQTT/Task resolve.

## Verificação ponta-a-ponta (geral)
1. `pnpm db:migrate && pnpm db:seed` aplica migrations + backfill (todo recurso com `siteId`).
2. `pnpm dev`; login OK (QF-A).
3. `/map`: desenhar contorno (geoman) → máscara + maxBounds + clusters; outdoor na
   coord real; bin/câmera indoor herda/cascateia o Site; troca de `baseMode`
   (base suave/satélite/overlay — fonte da decisão nº 3); zonas coloridas com
   `zoneId` recalculado; overlay do dono via storage.
4. Publicar leitura MQTT por device (QF-B) → **uma** leitura, na lixeira certa,
   e o marcador atualiza sozinho **com cluster ligado** (Fase 3).
5. `GET /analytics/bins?groupBy=zone` coerente com as posições.
