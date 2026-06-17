# Colecta — Pitch de Investimento

> **A central de operações de grandes complexos.**
> Um único aplicativo para administrar **toda** a operação de áreas extensas — zoológicos, parques de diversões, campi universitários, parques e resorts: limpeza, manutenção, segurança e administração trabalhando no mesmo lugar, com dados em tempo real e tarefas que se resolvem sozinhas.

---

## 1. O problema

Quem administra um **parque de diversões, zoológico, faculdade ou parque** gerencia, na prática, uma pequena cidade — com hectares de área, milhares de visitantes/dia e dezenas de equipes diferentes. Mas a operação é fragmentada e cega:

- **Cada área fala uma língua** — limpeza num grupo de WhatsApp, segurança no rádio, manutenção numa planilha, administração no e-mail. Ninguém tem a visão do todo.
- **Operação sem mapa** — em uma área enorme, ninguém sabe ao certo *onde* está o problema: qual lixeira transbordou, qual câmera caiu, em que ponto do parque a equipe precisa ir.
- **Reação tardia** — a lixeira enche perto da praça de alimentação lotada, a câmera de um setor sai do ar — e a gestão só descobre pela reclamação do visitante. Em local de grande circulação, isso vira **experiência ruim, risco e dano à imagem**.
- **Zero rastreabilidade** — quem atendeu? quando? a tarefa foi concluída? Não há histórico para cobrar, auditar ou melhorar.

O resultado: equipes superdimensionadas para "garantir que nada falhe", e ainda assim falhas visíveis ao público.

---

## 2. A solução: Colecta

Um **"Jira para grandes áreas"** — uma plataforma web única que **centraliza todas as frentes da operação** num só lugar, sobre um mapa do complexo inteiro.

> O diferencial não é uma função isolada. É a **centralização**: limpeza, manutenção, segurança e administração deixam de viver em ferramentas separadas e passam a operar sobre a **mesma plataforma, o mesmo mapa e a mesma fila de tarefas**.

### Tudo numa tela só

- 🗺️ **Mapa único do complexo** — cada lixeira, câmera, equipe e tarefa georreferenciada. A administração enxerga o parque inteiro de uma vez.
- 🧹 **Limpeza** — lixeiras inteligentes com sensor de enchimento avisam quando estão cheias; a tarefa de esvaziar nasce sozinha e vai para a equipe certa.
- 🔧 **Manutenção** — sensor com bateria fraca ou ativo offline vira tarefa automática, com prioridade e prazo.
- 🛡️ **Segurança** — inventário e status das câmeras (online/offline/manutenção) no mesmo mapa; câmera caiu, abre tarefa.
- 🏢 **Administração** — dashboard, analytics de produtividade por equipe e relatórios exportáveis para auditoria e prestação de contas.

Cada papel — **Admin, Manutenção, Limpeza, Segurança, Financeiro** — entra e vê **exatamente o que é dele**, mas tudo flui dentro do mesmo sistema, sob a mesma gestão.

### Como funciona, na prática

1. **Sensores espalhados pela área** (lixeiras, equipamentos) publicam telemetria via **MQTT** — nível de enchimento, bateria, temperatura, localização.
2. A Colecta **ingere as leituras em tempo real**, atualiza cada ativo e sua posição no mapa.
3. Um **motor de automação** detecta problemas e **abre tarefas sozinho**, com prioridade e prazo conforme a criticidade:
   - Lixeira cheia (≥90%) → tarefa **alta**, prazo 4h → vai para **Limpeza**.
   - Ativo offline (>24h) → tarefa **urgente**, prazo 6h.
   - Bateria baixa (≤20%) → tarefa **média**, prazo 24h → vai para **Manutenção**.
4. A tarefa é **roteada para a equipe certa** e a pessoa recebe **notificação**. Fica tudo registrado: quem iniciou, quando concluiu.
5. A administração acompanha por **dashboard, mapa e relatórios** — e cobra resultado com dado, não com achismo.

> A operação deixa de ser reativa e fragmentada, e passa a ser **centralizada, georreferenciada e dirigida por evento**.

---

## 3. Produto — o que já está construído

A Colecta **não é uma ideia em slide**: é um produto funcional, multi-tenant, já implementado.

| Módulo | O que entrega |
| --- | --- |
| **Mapa do complexo** | Todas as lixeiras e câmeras georreferenciadas, status visual instantâneo (react-leaflet). |
| **Limpeza / Lixeiras** | Cadastro, nível de enchimento, bateria, capacidade, histórico de leituras por ativo. |
| **Segurança / Câmeras** | Inventário e status de câmeras (online/offline/manutenção) integrado ao mapa e às tarefas. |
| **Manutenção** | Tarefas automáticas por bateria baixa ou ativo offline. |
| **Ingestão IoT (MQTT)** | Recebe telemetria dos sensores em campo de forma contínua e padronizada. |
| **Automação de tarefas** | Motor de regras que cria e atualiza tarefas sozinho a partir dos sensores. |
| **Gestão de tarefas** | Fluxo pendente → em andamento → concluída, com prioridade, prazo, responsável e rastreabilidade total. |
| **Equipes por função** | Papéis Admin, Manutenção, Limpeza, Segurança, Financeiro — cada um atua no que é seu. |
| **Notificações** | Alertas de tarefa atribuída, urgente, atrasada e concluída. |
| **Analytics (Administração)** | Resumo operacional, produtividade por equipe, throughput e atividade por ativo. |
| **Relatórios** | Exportação de dados para auditoria e prestação de contas. |
| **Financeiro** | Visão de custos atrelada à operação. |
| **Multi-tenant & login** | Cada cliente (parque, zoológico, faculdade) isolado por `tenant` — pronto para SaaS. |

**Stack:** React + TypeScript + Vite no frontend; NestJS + Prisma + PostgreSQL no backend; monorepo pnpm; deploy containerizado (Docker). Arquitetura modular, escalável e pronta para nuvem.

---

## 4. Por que agora

- **Experiência do visitante virou prioridade** — em parques de diversões, zoológicos e resorts, limpeza e segurança visíveis são parte do produto que se vende ao público.
- **Custo de IoT despencou** — sensores de nível e telemetria hoje custam uma fração do que custavam há 5 anos, viabilizando o ROI mesmo em escala de um único complexo.
- **Pressão por eficiência e ESG** — grandes operadores precisam fazer mais com equipes enxutas e prestar contas de sustentabilidade.
- **Ferramentas de gestão são genéricas** — não existe um "centro de comando" pensado para a realidade física e georreferenciada de uma grande área.

---

## 5. Modelo de negócio

**SaaS B2B por assinatura recorrente**, vendido ao operador do complexo:

- **Setup & hardware** — venda ou comodato dos sensores + onboarding do cliente.
- **Assinatura mensal** — por ativo monitorado (lixeira, câmera) e/ou por área/usuários.
- **Upsell** — analytics avançado, relatórios de compliance, novos módulos operacionais.

A arquitetura multi-tenant já permite servir múltiplos clientes na mesma plataforma desde o dia um.

### Clientes-alvo
- **Parques de diversões** e parques temáticos
- **Zoológicos**, jardins botânicos e aquários
- **Campi universitários** e grandes faculdades
- **Parques urbanos, resorts e clubes** de grande área
- Complexos de eventos, feiras e centros de convenções

---

## 6. Tração de produto e roadmap

**Já entregue:** MVP funcional com automação, IoT, multi-tenant, equipes por função, mapa, analytics e relatórios — cobrindo limpeza, manutenção, segurança e administração.

**Próximos passos:**
- **App de campo (mobile)** para as equipes receberem e fecharem tarefas no celular, dentro do parque.
- **Rotas otimizadas** de atendimento (sequenciar os pontos a atender → menos deslocamento na área).
- **Previsão de enchimento** por histórico (encher antes de transbordar).
- Mapa em **tempo real via WebSocket**.
- **Novos módulos centralizáveis** — controle de acesso, ativos/equipamentos, ocorrências de visitantes — ampliando o "tudo num app só".

---

## 7. A proposta de valor, em uma frase

> **Um parque de diversões, um zoológico ou uma faculdade não precisa de cinco ferramentas e cinco grupos de WhatsApp para se administrar — precisa de uma só. A Colecta é essa central, e ela já existe e funciona.**

---

## 8. O pedido

Buscamos investimento para:

1. **Comercial & go-to-market** — fechar os primeiros contratos âncora (um parque de diversões / um zoológico / uma faculdade) como prova de conceito faturada.
2. **Hardware & piloto** — financiar o primeiro lote de sensores instalados em um complexo real.
3. **Produto** — entregar o app de campo, rotas otimizadas e os próximos módulos centralizáveis.

Com um piloto pago e métricas reais de eficiência operacional, a Colecta tem o caso de negócio para escalar como **a central de operações padrão de grandes complexos**.

---

*Documento gerado a partir da leitura técnica do código-fonte do projeto Colecta.*
