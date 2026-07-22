# Deploy: banco + API na Render, front na Vercel

Arquitetura do plano gratuito:

```
Vercel (estático, nunca dorme)        Render (dorme após 15 min)
  apps/web  ──── VITE_API_URL ────►  colecta-api ──► colecta-db (Postgres)
```

O front abre instantâneo; só os dados ficam carregando enquanto a API acorda.

---

## 1. Banco + API na Render

O repositório já traz `render.yaml`, então dá para subir os dois de uma vez:

**Render → New → Blueprint → selecione este repositório.**

Isso cria:

- `colecta-db` — Postgres free
- `colecta-api` — web service Docker, buildado com `apps/api/Dockerfile`

As variáveis já vêm resolvidas pelo blueprint:

| Variável | Origem |
| --- | --- |
| `DATABASE_URL` | Internal Connection String do `colecta-db` (automático) |
| `JWT_SECRET` | gerado pela Render no 1º deploy |
| `MQTT_INGEST_ENABLED` | `false` (ver [ressalvas](#5-ressalvas-do-plano-gratuito)) |
| `PORT` | injetada pela Render; `src/main.ts` já lê `process.env.PORT` |

**Migrations rodam sozinhas.** O `apps/api/docker-entrypoint.sh` executa
`prisma migrate deploy` antes de subir a API, em todo start.

Se preferir criar na mão em vez do blueprint, use runtime **Docker**, Dockerfile
`./apps/api/Dockerfile`, contexto `.` (a raiz do repo — o build precisa do
`pnpm-lock.yaml`), e Health Check Path `/health`.

### Envs opcionais da API

Só se for usar e-mail de notificação: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
`SMTP_PASS`, `SMTP_FROM`.

---

## 2. Popular o banco (usuários iniciais)

Sem isso não há como logar. O plano free **não tem shell** na Render, então rode
da sua máquina apontando para a **External Database URL** do `colecta-db`
(Render → colecta-db → Connections). Conexão externa exige SSL:

```bash
# PowerShell
$env:DATABASE_URL = "postgresql://...oregon-postgres.render.com/colecta?sslmode=require"
pnpm --filter @colecta/api db:create-users
```

`db:create-users` é aditivo: faz upsert de um usuário por função, sem apagar
nada. Login: `admin@colecta.com` / `colecta123`.

> No fim o script imprime *"o admin mantém a senha definida no seed: admin123"*.
> Isso só vale se o seed tiver rodado antes — em banco novo, que é o caso do
> deploy, o admin é criado aqui e a senha é `colecta123`.

Para dados de demonstração completos (tenants, lixeiras, tarefas) use
`pnpm --filter @colecta/api prisma:seed` — mas atenção: **o seed limpa as
tabelas antes de inserir**.

---

## 3. Front na Vercel

**Vercel → Add New → Project → importe o repositório.**

- **Root Directory:** deixe na raiz (`./`). O `vercel.json` já aponta o build
  para `apps/web` e define o rewrite de SPA do react-router.
- **Environment Variables:** `VITE_API_URL` = `https://colecta-api.onrender.com`
  (a URL da API na Render, **sem** barra no final).

`VITE_API_URL` é lida em build-time e embutida no bundle
(`apps/web/src/lib/api/client.ts`). Trocar a URL exige **redeploy**, não basta
salvar a variável.

> Se o build falhar reclamando da versão do Node, fixe **Node 22.x** em
> Project Settings → General → Node.js Version.

---

## 4. CORS

A API já responde com `origin: true` (reflete qualquer origem) em
`apps/api/src/main.ts`, então o domínio da Vercel funciona sem configuração.
Se um dia quiser restringir, é ali que se mexe — a `CORS_ORIGIN` do
`.env.example` está órfã, nenhum código a lê.

---

## 5. Ressalvas do plano gratuito

- **Cold start:** a API dorme após 15 min sem tráfego HTTP. O primeiro acesso
  depois disso leva ~30–50 s. Some a isso o `prisma migrate deploy` do
  entrypoint (poucos segundos, no-op quando não há migration nova).
- **O Postgres free da Render expira em 30 dias.** Depois disso ele é removido e
  os dados vão junto. Para algo que precise durar, é o item a virar pago.
- **MQTT:** com `MQTT_INGEST_ENABLED=true`, a conexão com o broker cai junto com
  o serviço quando ele dorme — e nada mantém o serviço acordado, porque o
  spin-down olha só tráfego HTTP de entrada. As leituras publicadas enquanto
  dorme se perdem. Por isso o blueprint deixa `false`.

---

## 6. Checklist antes do primeiro deploy

- [ ] `git push` com tudo commitado (a Render e a Vercel buildam do GitHub)
- [ ] Blueprint aplicado na Render, deploy verde, `GET /health` retorna
      `{"status":"ok","db":"up"}`
- [ ] `db:create-users` rodado contra a External Database URL
- [ ] `VITE_API_URL` configurada na Vercel apontando para a API
- [ ] Login funcionando no domínio da Vercel
