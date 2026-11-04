# Deploy em produção

Guia completo para colocar o projeto no ar: a LLM roda no desktop de casa, a Cloudflare expõe essa LLM com segurança, o backend sobe na Railway e o front na Vercel.

## Arquitetura

```text
 Visitante
    │  HTTPS
    ▼
┌──────────────┐   HTTPS (SSE)   ┌──────────────────────── Railway ───────────────────────┐
│ Vercel       │ ──────────────▶ │ API (Fastify)  ──▶ Postgres (uso + conversas)          │
│ web/ (Vite)  │                 │      │         ──▶ Neo4j (índice vetorial do perfil)   │
└──────────────┘                 │      │  embeddings rodam dentro da API (transformers)  │
                                 └──────┼─────────────────────────────────────────────────┘
                                        │ HTTPS + headers do Cloudflare Access
                                        ▼
                              ┌────────────────────┐
                              │ Cloudflare Tunnel  │  ollama.seudominio.com
                              └─────────┬──────────┘
                                        │ conexão de saída (nenhuma porta aberta no roteador)
                                        ▼
                              ┌────────────────────┐
                              │ Desktop de casa    │  cloudflared ──▶ Ollama (localhost:11434)
                              │ gemma4:e2b         │
                              └────────────────────┘
```

Só a API conversa com o Ollama. O navegador do visitante nunca acessa o desktop.

## Ordem de execução

1. [Antes de começar](#0-antes-de-começar): pendências de código e contas
2. [Desktop: Ollama e Gemma](#1-desktop-ollama-e-gemma)
3. [Cloudflare: domínio, tunnel e Access](#2-cloudflare-domínio-tunnel-e-access)
4. [Testar a LLM de fora](#3-testar-a-llm-de-fora)
5. [Backend na Railway](#4-backend-na-railway): Postgres, Neo4j, seed e API
6. [Front na Vercel](#5-front-na-vercel)
7. [Fechar o CORS e smoke test](#6-fechar-o-cors-e-smoke-test)

---

## 0. Antes de começar

### Pendências de código

| Item | Status | Impacto se faltar |
| --- | --- | --- |
| API sobe sem `.env`, lê `PORT` e roda migrations no boot | feito | |
| Allowlist de modelos, CORS com lista, rate limit, headers do Access, mensagem de offline | feito | |
| **Liberar o Gemma no front** (`web/src/config/models.ts`: `gemma4:e2b` com `locked: false` e como primeiro da lista) | pendente | O front envia outro modelo, e a API responde 400 "Modelo não disponível." |
| Conversas no Postgres com retenção de 7 dias | pendente | As conversas ficam na memória da API e somem a cada deploy ou restart |
| Cache dos embeddings | pendente | O primeiro boot de cada deploy baixa ~90 MB da Hugging Face |
| Build do front falhar sem `VITE_API_URL` | pendente | Se a variável faltar, o front aponta para `127.0.0.1` sem avisar |

### Contas necessárias

- Cloudflare (grátis) e um domínio com o DNS gerenciado por ela
- Railway (plano Hobby, US$ 5/mês, inclui uso)
- Vercel (Hobby, grátis)
- Repositório no GitHub com o projeto (Railway e Vercel fazem deploy a partir dele)

---

## 1. Desktop: Ollama e Gemma

Os comandos abaixo são para **Windows**. Para Linux, veja o [anexo](#anexo-a-desktop-com-linux).

### 1.1 Instalar o Ollama

Baixe e instale em <https://ollama.com/download>.

### 1.2 Variáveis de ambiente

No PowerShell (não precisa ser administrador):

```powershell
[Environment]::SetEnvironmentVariable("OLLAMA_KEEP_ALIV
[Environment]::SetEnvironmentVariable("OLLAMA_CONTEXT_LENGTH", "16384", "User")
```

Para conferir:

```powershell
[Environment]::GetEnvironmentVariable("OLLAMA_KEEP_ALIVE", "User")
[Environment]::GetEnvironmentVariable("OLLAMA_CONTEXT_LENGTH", "User")
```

Alternativa pela interface: Iniciar → "Editar as variáveis de ambiente para sua conta" → **Novo** para cada variável.

| Variável | Para quê |
| --- | --- |
| `OLLAMA_KEEP_ALIVE=24h` | Mantém o modelo carregado na memória, para a primeira resposta não demorar |
| `OLLAMA_CONTEXT_LENGTH=16384` | Cada pergunta envia até 10 trechos de 1000 caracteres do perfil, mais o prompt e o histórico. Com o contexto padrão, que é pequeno, o RAG é cortado |

**Não** defina `OLLAMA_HOST=0.0.0.0`. O tunnel roda na mesma máquina e acessa `localhost`. Expor o Ollama na rede local não é necessário.

Feche o Ollama pelo ícone da bandeja e abra de novo, para ele carregar as variáveis.

### 1.3 Baixar e validar o modelo

```powershell
ollama pull gemma4:e2b
ollama show gemma4:e2b
```

Em **Capabilities** precisa aparecer `tools`. O agente só consulta o perfil por tool calling (`search_profile`). Sem `tools`, o modelo responde sem RAG, então troque por outro modelo local que tenha essa capability.

Teste rápido:

```powershell
ollama run gemma4:e2b "Responda só: ok"
```

### 1.4 Deixar o desktop sempre disponível

- **Energia:** em Configurações → Sistema → Energia, ajuste "Suspender" para **Nunca**. Desative a hibernação com `powercfg /h off`, num PowerShell como administrador.
- **O Ollama no Windows é um app de bandeja e só roda com o usuário logado.** Escolha uma opção:
  - Login automático do Windows (`netplwiz` → desmarcar "Os usuários devem digitar um nome de usuário e uma senha"). É a opção mais simples.
  - Uma tarefa no **Agendador de Tarefas** com o programa `ollama` e o argumento `serve`, gatilho "Ao iniciar o sistema" e a opção "Executar estando o usuário conectado ou não". Nesse caso, remova o Ollama da inicialização do usuário, para não subirem duas instâncias.
- **Atualizações do Windows:** defina um horário ativo para evitar reinícios no meio do dia.

---

## 2. Cloudflare: domínio, tunnel e Access

### 2.1 Domínio

O domínio precisa estar com o DNS na Cloudflare.

- Já tem domínio: em <https://dash.cloudflare.com>, clique em **Add a domain**, escolha o plano Free e troque os nameservers no registrador pelos que a Cloudflare indicar. A propagação leva de minutos a algumas horas.
- Não tem domínio: compre no **Cloudflare Registrar** (Domain Registration → Register Domains). O DNS já fica configurado.

O quick tunnel (`*.trycloudflare.com`) não serve para produção, porque a URL muda a cada reinício.

### 2.2 Criar o tunnel (pelo painel)

1. Acesse <https://one.dash.cloudflare.com> e vá em **Networks → Tunnels → Create a tunnel**.
2. Escolha **Cloudflared** e use o nome `ollama`.
3. Escolha **Windows**. O painel mostra um comando com um token.
4. No desktop, num PowerShell **como administrador**:
   ```powershell
    winget install --id Cloudflare.cloudflared
    cloudflared.exe service install <TOKEN_DO_PAINEL>
   ```

    Isso instala o tunnel como **serviço do Windows**, que sobe com o sistema mesmo sem login.
5. Volte ao painel e espere o status do conector ficar **Healthy**.

### 2.3 Hostname público

Na aba **Public Hostname** do tunnel, clique em **Add a public hostname**:

| Campo | Valor |
| --- | --- |
| Subdomain | `ollama` |
| Domain | `seudominio.com` |
| Service Type | `HTTP` |
| URL | `localhost:11434` |
| Additional application settings → HTTP Settings → **HTTP Host Header** | `localhost:11434` |

Sem o **HTTP Host Header**, o Ollama pode recusar a requisição com 403.

### 2.4 Proteger com Cloudflare Access (obrigatório)

Sem este passo, qualquer pessoa com a URL usa a sua GPU.

**Service Token** (a credencial que a API vai usar):

1. Vá em **Access → Service Auth → Service Tokens → Create Service Token**.
2. Use o nome `railway-api` e a duração **Non-expiring**, ou um prazo que você vai lembrar de renovar.
3. Copie o **Client ID** e o **Client Secret**. O secret só aparece uma vez. Guarde num gerenciador de senhas.

**Aplicação:**

1. Vá em **Access → Applications → Add an application → Self-hosted**.
2. Application domain: `ollama.seudominio.com`.
3. Policy: nome `api-only`, Action **Service Auth**, Include → **Service Token** → `railway-api`.
4. Salve.

O Zero Trust é grátis até 50 usuários, mas pode pedir um cartão no cadastro.

---

## 3. Testar a LLM de fora

De outra máquina (o notebook, por exemplo):

```bash
# 1. Sem credenciais: precisa ser BLOQUEADO (403, ou 302 para a tela de login)
curl -i https://ollama.seudominio.com/api/tags

# 2. Com credenciais: precisa listar os modelos, incluindo gemma4:e2b
curl https://ollama.seudominio.com/api/tags \
  -H "CF-Access-Client-Id: <CLIENT_ID>" \
  -H "CF-Access-Client-Secret: <CLIENT_SECRET>"

# 3. Geração de verdade
curl https://ollama.seudominio.com/api/chat \
  -H "CF-Access-Client-Id: <CLIENT_ID>" \
  -H "CF-Access-Client-Secret: <CLIENT_SECRET>" \
  -d '{"model":"gemma4:e2b","messages":[{"role":"user","content":"diga oi"}],"stream":false}'
```

### Teste ponta a ponta antes do deploy (opcional, recomendado)

Aponte a API local do notebook para o desktop. Acrescente no `api/.env`:

```env
OLLAMA_URL="https://ollama.seudominio.com"
OLLAMA_CF_CLIENT_ID="<CLIENT_ID>"
OLLAMA_CF_CLIENT_SECRET="<CLIENT_SECRET>"
OLLAMA_MODEL="gemma4:e2b"
ALLOWED_MODELS="ollama:gemma4:e2b"
```

```bash
cd api && npm run infra:up && npm run api
cd web && pnpm dev
```

Pergunte algo sobre o perfil no chat. A resposta precisa citar trechos do PDF, e o passo `search_profile` precisa aparecer.

---

## 4. Backend na Railway

São três serviços no mesmo projeto: **Postgres**, **Neo4j** e **API**. Eles se falam pela rede privada da Railway (`*.railway.internal`).

### 4.1 Criar o projeto

1. Acesse <https://railway.com> e clique em **New Project → Empty Project**.
2. Escolha a região mais próxima de você e dos visitantes.

### 4.2 Postgres

1. Clique em **+ Create → Database → PostgreSQL**.
2. Pronto. A variável `DATABASE_URL` fica disponível para os outros serviços como `${{Postgres.DATABASE_URL}}`.

As tabelas são criadas pela própria API no boot (as migrations rodam sozinhas).

### 4.3 Neo4j

1. Clique em **+ Create → Docker Image** e use `neo4j:5.14.0-community`.
2. Renomeie o serviço para `neo4j`.
3. Em **Variables**:
   ```env
    NEO4J_AUTH=neo4j/<SENHA_FORTE>
    NEO4J_server_memory_heap_initial__size=256m
    NEO4J_server_memory_heap_max__size=512m
    NEO4J_server_memory_pagecache_size=256m
   ```

    O APOC não é necessário: o índice vetorial é nativo do Neo4j 5.
4. Em **Settings → Volumes**, adicione um volume montado em `/data`. Sem ele, o índice some a cada restart.
5. Em **Settings → Networking**, ative o **TCP Proxy** na porta `7687`. Ele só é necessário para o seed, no próximo passo. Anote o endereço, por exemplo `xxx.proxy.rlwy.net:12345`.

### 4.4 Seed: popular o Neo4j com o perfil

Rode do notebook, apontando para o Neo4j da Railway. As variáveis passadas na linha de comando têm prioridade sobre o `.env`:

```bash
cd api
NEO4J_URI="bolt://xxx.proxy.rlwy.net:12345" \
NEO4J_USER="neo4j" \
NEO4J_PASSWORD="<SENHA_FORTE>" \
npm run seed
```

Depois do seed, **desative o TCP Proxy**: a API acessa o Neo4j pela rede privada. Para atualizar o perfil no futuro, troque o `api/data/Profile.pdf`, reative o proxy e rode o seed de novo.

### 4.5 API

1. Clique em **+ Create → GitHub Repo** e selecione o repositório.
2. Em **Settings**:
   | Campo | Valor |
    |---|---|
    | Root Directory | `api` |
    | Start Command | `npm start` |
    | Healthcheck Path | `/health` |
    | Networking → **Generate Domain** | gera `https://<nome.up.railway.app>` |

    O build é detectado sozinho (Node pelo `engines` do `package.json`). O `.npmrc` com `legacy-peer-deps` já está em `api/`.
3. Em **Variables**:
   ```env
    # Banco e grafo (rede privada)
    DATABASE_URL=${{Postgres.DATABASE_URL}}
    NEO4J_URI=bolt://neo4j.railway.internal:7687
    NEO4J_USER=neo4j
    NEO4J_PASSWORD=<SENHA_FORTE>

    # LLM no desktop
    LLM_PROVIDER=ollama
    OLLAMA_URL=https://ollama.seudominio.com
    OLLAMA_CF_CLIENT_ID=<CLIENT_ID>
    OLLAMA_CF_CLIENT_SECRET=<CLIENT_SECRET>
    OLLAMA_MODEL=gemma4:e2b
    ALLOWED_MODELS=ollama:gemma4:e2b

    # Embeddings (rodam dentro da API)
    EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2

    # HTTP
    TRUST_PROXY_HOPS=1
    CORS_ORIGIN=*
   ```

    Não defina `PORT` nem `API_HOST`: a Railway injeta `PORT`, e o host padrão já é `0.0.0.0`.

    O `CORS_ORIGIN=*` é temporário. Ele é fechado no passo 6, quando o domínio da Vercel já existir.
4. Faça o deploy e acompanhe os logs. O esperado é:
   - Migrations aplicadas, sem erro.
   - `Server listening at http://0.0.0.0:<PORT>`.
   - O primeiro boot demora um pouco a mais, porque baixa o modelo de embeddings.
5. Teste:
   ```bash
    curl https://<nome.up.railway.app/health>        # {"status":"ok"}
    curl https://<nome.up.railway.app/api/tools>     # lista search_profile e get_weather
   ```

**Conferir o `TRUST_PROXY_HOPS`:** faça uma requisição e veja, nos logs da Railway, o IP registrado na requisição. Ele precisa ser o seu IP público, não um IP interno da Railway. Se aparecer um IP interno, aumente para `2`.

---

## 5. Front na Vercel

1. Acesse <https://vercel.com>, clique em **Add New → Project** e importe o repositório.
2. Configure:
   | Campo | Valor |
    |---|---|
    | Root Directory | `web` |
    | Framework Preset | Vite |
    | Build Command | `pnpm build`, detectado pelo `pnpm-lock.yaml` |
    | Output Directory | `dist` |
3. Em **Environment Variables** (Production e Preview):
   ```env
    VITE_API_URL=https://<nome.up.railway.app>
   ```

    A variável é lida **no build**. Se você mudar o valor, faça um redeploy.
4. Faça o deploy. O roteamento é por hash (`#/chat`, `#/dashboard`), então não precisa de rewrites.

---

## 6. Fechar o CORS e smoke test

### 6.1 CORS

Na Railway, na API, troque o `CORS_ORIGIN` pelo domínio de produção, mais os previews se você quiser usá-los:

```env
CORS_ORIGIN=https://seu-projeto.vercel.app,https://www.seudominio.com
```

Cada preview da Vercel tem uma URL diferente. Para testar um preview específico, inclua a URL dele na lista temporariamente.

### 6.2 Smoke test

| Teste | Resultado esperado |
| --- | --- |
| Abrir o site e perguntar "Onde o Pedro trabalha?" | Resposta com dados do PDF, mostrando o passo `search_profile` |
| Abrir o Dashboard | A pergunta anterior aparece nos números |
| Enviar 11 mensagens em menos de 1 minuto | A 11ª mostra "Muitas mensagens em pouco tempo. Aguarde um minuto." |
| Desligar o Ollama no desktop e perguntar algo | "O modelo local está offline no momento. Tente novamente mais tarde." |
| `curl -i https://ollama.seudominio.com/api/tags`, sem headers | Bloqueado |

---

## Referência de variáveis da API

| Variável | Obrigatória | Produção | Descrição |
| --- | --- | --- | --- |
| `DATABASE_URL` | sim | `${{Postgres.DATABASE_URL}}` | Postgres de uso e conversas |
| `NEO4J_URI` | sim | `bolt://neo4j.railway.internal:7687` | Neo4j com o índice vetorial |
| `NEO4J_USER` / `NEO4J_PASSWORD` | sim | `neo4j` / senha forte | Credenciais do Neo4j |
| `EMBEDDING_MODEL` | sim | `Xenova/all-MiniLM-L6-v2` | Precisa ser o mesmo usado no seed |
| `LLM_PROVIDER` | não | `ollama` | O OpenRouter está desligado por enquanto |
| `OLLAMA_URL` | não | `https://ollama.seudominio.com` | URL do tunnel |
| `OLLAMA_MODEL` | não | `gemma4:e2b` | Modelo padrão |
| `OLLAMA_CF_CLIENT_ID` / `OLLAMA_CF_CLIENT_SECRET` | em produção | Service Token | Definir os dois juntos |
| `ALLOWED_MODELS` | recomendado | `ollama:gemma4:e2b` | Lista `provider:model`. Vazia aceita só o modelo padrão |
| `CORS_ORIGIN` | recomendado | domínios do front | `*` ou lista separada por vírgula |
| `TRUST_PROXY_HOPS` | em produção | `1` | Proxies na frente da API, usado para o rate limit por IP |
| `PORT` | não | injetada pela Railway | Tem prioridade sobre `API_PORT` |
| `API_HOST` | não | não definir | O padrão é `0.0.0.0` |

---

## Problemas comuns

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| Chat mostra "modelo local está offline" | Desktop desligado ou suspenso, Ollama fechado ou tunnel caído | Ver o status do tunnel no painel (Healthy?) e rodar `ollama ps` no desktop |
| Chat mostra "Erro ao gerar a resposta." e o log da API tem 403 | Service Token errado, expirado ou fora da policy | Conferir o ID e o secret na Railway e a policy da aplicação no Access |
| 403 vindo do próprio Ollama | Faltou o **HTTP Host Header** no hostname do tunnel | Passo 2.3 |
| "Modelo não disponível." | O front envia um modelo fora do `ALLOWED_MODELS` | Liberar o Gemma no `models.ts` (pendência do passo 0) ou ajustar a allowlist |
| Erro de CORS no console do navegador | Domínio do front fora do `CORS_ORIGIN` | Passo 6.1 |
| API não sobe: `Vector index "tensors_index" not found` | Seed não rodou ou o Neo4j está sem volume | Passos 4.3 (volume) e 4.4 |
| Respostas genéricas, sem dados do perfil | Modelo sem `tools` ou contexto pequeno | Passo 1.3 (`ollama show`) e `OLLAMA_CONTEXT_LENGTH` |
| Rate limit atinge todo mundo ao mesmo tempo | `TRUST_PROXY_HOPS` errado: todos parecem ter o IP do proxy | Passo 4.5, conferir o `TRUST_PROXY_HOPS` |

---

## Anexo A: desktop com Linux

```bash
# Ollama (já instala como serviço systemd)
curl -fsSL https://ollama.com/install.sh | sh

# Variáveis do serviço
sudo systemctl edit ollama
# No editor, acrescente:
# [Service]
# Environment="OLLAMA_KEEP_ALIVE=24h"
# Environment="OLLAMA_CONTEXT_LENGTH=16384"
sudo systemctl daemon-reload && sudo systemctl restart ollama

ollama pull gemma4:e2b && ollama show gemma4:e2b

# cloudflared (Debian/Ubuntu); o token vem do painel, passo 2.2
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
sudo cloudflared service install <TOKEN_DO_PAINEL>

# Impedir a suspensão
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
```

## Anexo B: backend numa VPS da Hostinger em vez da Railway

A hospedagem compartilhada da Hostinger não serve: ela não roda Node de longa duração nem Neo4j. Com uma **VPS** (KVM 2 ou maior, por causa do Neo4j e dos embeddings):

1. Instale Docker e Docker Compose na VPS.
2. Suba Postgres e Neo4j com um compose parecido com `api/docker-compose.yml`, mas **sem publicar as portas** dos bancos. Use senhas fortes.
3. Rode a API com `npm start` num container ou com `pm2`, apontando para os bancos pela rede do compose.
4. Coloque um proxy reverso com HTTPS na frente (Caddy é o mais simples) e use `TRUST_PROXY_HOPS=1`.
5. Para o seed, rode `npm run seed` na própria VPS.

Nesse caso, segurança, backups e atualizações do sistema ficam por sua conta. Por isso a Railway é a opção recomendada.
