# Deploy em produção

Guia para colocar o projeto no ar com o backend e a LLM rodando no desktop Windows de casa.

| Parte | Onde roda |
| --- | --- |
| Front (`web/`) | Vercel |
| Backend (`api/`) | Desktop Windows, como serviço |
| LLM (Ollama + `qwen3:14b`) | Desktop Windows |
| Neo4j | Neo4j Aura Free (hospedado) |
| Postgres | Neon (hospedado) |

## Arquitetura

```text
 Visitante
    │ HTTPS
    ▼
┌──────────────┐  HTTPS (SSE)  ┌─────────────────────┐   tunnel    ┌──────────── Desktop Windows ────────────┐
│ Vercel       │ ────────────▶ │ Cloudflare          │ ──────────▶ │ cloudflared                             │
│ web/ (Vite)  │               │ api.monteirodev.com │  (conexão   │     │                                   │
└──────────────┘               └─────────────────────┘   de saída) │     ▼                                   │
                                                                   │ API (Node, serviço NSSM) :3333          │
                                                                   │     │                                   │
                                                                   │     └──▶ Ollama (qwen3:14b) :11434      │
                                                                   └─────┼───────────────────────────────────┘
                                                                         │ TLS
                                                          ┌──────────────┴──────────────┐
                                                          ▼                             ▼
                                                    Neo4j Aura Free               Neon Postgres
                                                    (índice vetorial)             (uso do chat)
```

- O navegador do visitante só acessa `api.monteirodev.com`. O Ollama nunca fica exposto: a API acessa ele por `localhost`.
- O tunnel é uma conexão de saída do desktop para a Cloudflare. Nenhuma porta é aberta no roteador.
- Se o desktop desligar, o site continua abrindo (ele está na Vercel), mas o chat e o dashboard param de responder.

## Ordem de execução

1. [Contas e pré-requisitos](#0-contas-e-pré-requisitos)
2. [Bancos hospedados: Neo4j Aura e Neon](#1-bancos-hospedados-neo4j-aura-e-neon)
3. [Desktop: Ollama e Qwen3](#2-desktop-ollama-e-qwen3)
4. [Desktop: backend](#3-desktop-backend)
5. [Desktop: rodar em segundo plano](#4-desktop-rodar-em-segundo-plano)
6. [Cloudflare: tunnel para o backend](#5-cloudflare-tunnel-para-o-backend)
7. [Front na Vercel](#6-front-na-vercel)
8. [Fechar o CORS e smoke test](#7-fechar-o-cors-e-smoke-test)

---

## 0. Contas e pré-requisitos

- **GitHub**, com o repositório do projeto. A Vercel faz deploy a partir dele, e o desktop clona o código dele.
- **Cloudflare** (grátis), com o domínio `monteirodev.com` usando o DNS da Cloudflare.
- **Neo4j Aura** (Free): <https://console.neo4j.io>
- **Neon** (Free): <https://neon.tech>
- **Vercel** (Hobby, grátis): <https://vercel.com>

Antes de começar, faça o push da branch com as últimas alterações (`git push`), para o desktop e a Vercel pegarem o código atualizado.

---

## 1. Bancos hospedados: Neo4j Aura e Neon

### 1.1 Neo4j Aura

1. Em <https://console.neo4j.io>, crie uma instância **AuraDB Free**.
2. **Baixe o arquivo de credenciais** que aparece na criação. Ele traz `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD` e `NEO4J_DATABASE`, e a senha não é mostrada de novo.
3. **Mude a versão do Cypher.** As instâncias novas usam Cypher 25 por padrão, e o LangChain chama procedures que só existem no Cypher 5 (`db.index.vector.createNodeIndex`, `db.create.setVectorProperty`). Na instância, abra **Query** e rode:

   ```cypher
   ALTER DATABASE <NEO4J_DATABASE> SET DEFAULT LANGUAGE CYPHER 5
   ```

   Confira com `SHOW DATABASES YIELD name, defaultLanguage`. O banco precisa mostrar `CYPHER 5`.

**Atenção ao nome do banco.** No Aura, o banco não se chama `neo4j`: ele recebe o nome do ID da instância (por exemplo `f8168dd6`). Sem o `NEO4J_DATABASE` certo, a API falha com `DatabaseNotFound`.

O Aura Free pausa depois de alguns dias sem nenhuma consulta. Se isso acontecer, retome a instância no console. Com o site recebendo visitas, isso não deve acontecer.

### 1.2 Neon (Postgres)

1. Em <https://neon.tech>, crie um projeto. Escolha a região mais próxima do desktop (por exemplo, AWS São Paulo, se estiver disponível).
2. Em **Connect**, copie a connection string. Ela tem o formato:

   ```text
   postgresql://<usuario>:<senha>@<host>.neon.tech/neondb?sslmode=require
   ```

3. Você não precisa criar tabelas: a API aplica as migrations sozinha a cada boot.

---

## 2. Desktop: Ollama e Qwen3

### 2.1 Instalar o Ollama

Baixe e instale em <https://ollama.com/download>.

### 2.2 Variáveis de ambiente do Ollama

No PowerShell (não precisa ser administrador):

```powershell
[Environment]::SetEnvironmentVariable("OLLAMA_KEEP_ALIVE", "24h", "User")
[Environment]::SetEnvironmentVariable("OLLAMA_CONTEXT_LENGTH", "16384", "User")
```

Para conferir:

```powershell
[Environment]::GetEnvironmentVariable("OLLAMA_KEEP_ALIVE", "User")
[Environment]::GetEnvironmentVariable("OLLAMA_CONTEXT_LENGTH", "User")
```

| Variável | Para quê |
| --- | --- |
| `OLLAMA_KEEP_ALIVE=24h` | Mantém o modelo carregado na memória, para a primeira resposta não demorar |
| `OLLAMA_CONTEXT_LENGTH=16384` | Cada pergunta envia até 10 trechos de 1000 caracteres do perfil, mais o prompt e o histórico. Com o contexto padrão, que é pequeno, o RAG é cortado |

**Não** defina `OLLAMA_HOST=0.0.0.0`. A API roda na mesma máquina e acessa o Ollama por `localhost`.

Feche o Ollama pelo ícone da bandeja e abra de novo, para ele carregar as variáveis.

### 2.3 Baixar e validar o modelo

O `qwen3:14b` tem 9,3 GB e cabe nos 12 GB da RTX 5070.

```powershell
ollama pull qwen3:14b
ollama show qwen3:14b
```

Em **Capabilities** precisa aparecer `tools`. O agente só consulta o perfil por tool calling (`search_profile`).

```powershell
ollama run qwen3:14b "Responda só: ok"
```

Durante uma resposta, rode `ollama ps`. A coluna PROCESSOR precisa mostrar **100% GPU**. Se aparecer uma parte em CPU, o modelo com o contexto não coube na VRAM: reduza o `OLLAMA_CONTEXT_LENGTH` para `12288`.

---

## 3. Desktop: backend

### 3.1 Instalar as ferramentas

PowerShell **como administrador**:

```powershell
winget install --id Git.Git
winget install --id OpenJS.NodeJS.LTS
winget install --id NSSM.NSSM
```

Feche e abra o PowerShell, e confira as versões:

```powershell
git --version
node -v      # precisa ser 22.18 ou maior
nssm version
```

O Docker não é necessário: os bancos estão hospedados.

### 3.2 Baixar o projeto

```powershell
cd C:\
git clone https://github.com/opedro-monteiro/my-profile-rag.git
cd C:\my-profile-rag
git checkout feat/web-chat-ui
cd api
npm ci
```

Use sempre **npm** na pasta `api/`. O `.npmrc` dela tem `legacy-peer-deps=true`, e a instalação depende disso.

### 3.3 Criar o `.env`

```powershell
Copy-Item .env.example .env
notepad .env
```

O `.env.example` já traz os valores públicos. Preencha os que estão vazios:

| Variável | Onde pegar |
| --- | --- |
| `NEO4J_URI` | arquivo de credenciais do Aura (`neo4j+s://<ID>.databases.neo4j.io`) |
| `NEO4J_USER` | arquivo de credenciais do Aura (`NEO4J_USERNAME`) |
| `NEO4J_PASSWORD` | arquivo de credenciais do Aura |
| `NEO4J_DATABASE` | arquivo de credenciais do Aura (é o ID da instância) |
| `DATABASE_URL` | connection string do Neon (passo 1.2) |
| `CORS_ORIGIN` | por enquanto `*`. No passo 7 vira o domínio da Vercel |

O `.env` está no `.gitignore` e nunca deve ir para o git.

### 3.4 Popular o Neo4j (seed)

```powershell
npm run seed
```

O seed lê `data/Profile.pdf`, gera os embeddings e grava no Aura. Na primeira vez, ele também baixa o modelo de embeddings (~90 MB), que fica em cache no disco. Se a instância do Aura já foi populada antes, pode pular este passo.

### 3.5 Testar a API

```powershell
npm start
```

O esperado no log é `Server listening at http://127.0.0.1:3333`. Em outro PowerShell:

```powershell
curl.exe http://localhost:3333/health
curl.exe http://localhost:3333/api/tools
```

O primeiro precisa retornar `{"status":"ok"}`. Pare a API com `Ctrl+C` antes do próximo passo.

---

## 4. Desktop: rodar em segundo plano

São três processos que precisam subir sozinhos com o Windows:

| Processo | Como fica em segundo plano |
| --- | --- |
| `cloudflared` | Serviço do Windows, instalado no passo 5 |
| API | Serviço do Windows via **NSSM** (abaixo) |
| Ollama | App de bandeja: só roda com o usuário logado (abaixo) |

### 4.1 API como serviço (NSSM)

PowerShell **como administrador**:

```powershell
mkdir C:\my-profile-rag\api\logs

nssm install my-profile-rag "C:\Program Files\nodejs\node.exe" "--no-warnings --env-file-if-exists=.env src/cli/api.ts"
nssm set my-profile-rag AppDirectory "C:\my-profile-rag\api"
nssm set my-profile-rag DisplayName "my-profile-rag API"
nssm set my-profile-rag Start SERVICE_DELAYED_AUTO_START
nssm set my-profile-rag AppStdout "C:\my-profile-rag\api\logs\api.log"
nssm set my-profile-rag AppStderr "C:\my-profile-rag\api\logs\api.log"
nssm set my-profile-rag AppRotateFiles 1
nssm set my-profile-rag AppRotateOnline 1
nssm set my-profile-rag AppRotateBytes 10485760
nssm set my-profile-rag AppRestartDelay 10000

nssm start my-profile-rag
nssm status my-profile-rag
```

- `SERVICE_DELAYED_AUTO_START` sobe a API logo depois do boot, quando a rede já está pronta.
- Se a API não conseguir conectar no Aura ou no Neon (por exemplo, sem internet), ela encerra, e o NSSM tenta de novo a cada 10 segundos.
- Os logs ficam em `C:\my-profile-rag\api\logs\api.log`, com rotação a cada 10 MB.
- Se o Node não estiver em `C:\Program Files\nodejs\node.exe`, descubra o caminho com `(Get-Command node).Source`.

Confira de novo: `curl.exe http://localhost:3333/health`.

### 4.2 Ollama sempre no ar

O Ollama no Windows é um app de bandeja e só roda com o usuário logado. Escolha uma opção:

- **Login automático** (mais simples): rode `netplwiz`, desmarque "Os usuários devem digitar um nome de usuário e uma senha" e informe a senha. O Ollama já inicia com o usuário.
- **Agendador de Tarefas** (sem login): crie uma tarefa com o programa `ollama` e o argumento `serve`, gatilho "Ao iniciar o sistema" e a opção "Executar estando o usuário conectado ou não". Nesse caso, remova o Ollama da inicialização do usuário, para não subirem duas instâncias. As variáveis do passo 2.2 são do usuário: na tarefa, use a mesma conta.

### 4.3 Energia e atualizações

- Em Configurações → Sistema → Energia, ajuste "Suspender" para **Nunca**.
- Desative a hibernação: `powercfg /h off` (como administrador).
- Em Windows Update, defina um **horário ativo** para evitar reinícios no meio do dia. Depois de um reinício, tudo sobe sozinho.

---

## 5. Cloudflare: tunnel para o backend

### 5.1 Tunnel

Se o tunnel ainda não existe:

1. Acesse <https://one.dash.cloudflare.com> e vá em **Networking → Tunnels → Create a tunnel → Cloudflared**. Use o nome `desktop`.
2. Escolha **Windows**. O painel mostra um comando com um token. No desktop, num PowerShell **como administrador**:

   ```powershell
   winget install --id Cloudflare.cloudflared
   cloudflared.exe service install <TOKEN_DO_PAINEL>
   ```

3. Espere o status do conector ficar **Healthy**.

Se você já criou um tunnel antes (por exemplo, o `ollama`), reaproveite: basta trocar as rotas no próximo passo.

### 5.2 Rota pública para a API

A Cloudflare chama essa tela de **Published application routes**.

1. Em **Networking → Tunnels**, clique no nome do tunnel e abra a aba **Routes**.
2. Clique em **Add route → Published application**:

   | Campo | Valor |
   | --- | --- |
   | Subdomain | `api` |
   | Domain | `monteirodev.com` |
   | Path | vazio |
   | Service Type | `HTTP` |
   | URL | `localhost:3333` |

3. Salve. A Cloudflare cria sozinha o registro DNS de `api.monteirodev.com`.

**Não** crie uma aplicação do Cloudflare Access para `api.monteirodev.com`. A API precisa ser pública, porque o navegador dos visitantes chama ela direto. A proteção dela é o rate limit (10 mensagens por minuto por IP), a allowlist de modelos e o CORS.

### 5.3 Remover a exposição do Ollama

Se existir uma rota `ollama.monteirodev.com` de testes anteriores:

1. Apague essa rota na aba **Routes** do tunnel.
2. Em **Access → Applications**, apague a aplicação do `ollama.monteirodev.com`.
3. Em **Access → Service Auth → Service Tokens**, revogue o token que a API usaria.
4. Apague o registro DNS `ollama` em **DNS → Records**, caso ele não tenha sido removido junto com a rota.

### 5.4 Testar de fora

De outra máquina, ou do celular sem Wi-Fi:

```bash
curl https://api.monteirodev.com/health
curl https://api.monteirodev.com/api/tools
```

O `TRUST_PROXY_HOPS=1` do `.env` faz a API usar o IP real do visitante, enviado pela Cloudflare, no rate limit. Para conferir, faça uma requisição e veja o `remoteAddress` ou `ip` no `logs\api.log`: precisa ser o seu IP público, não `127.0.0.1`.

---

## 6. Front na Vercel

1. Em <https://vercel.com>, clique em **Add New → Project** e importe o repositório.
2. Configure:

   | Campo | Valor |
   | --- | --- |
   | Root Directory | `web` |
   | Framework Preset | Vite |
   | Build Command | `pnpm build` (detectado pelo `pnpm-lock.yaml`) |
   | Output Directory | `dist` |
   | Production Branch | a branch que você usa para publicar |

3. Em **Environment Variables** (Production e Preview):

   ```env
   VITE_API_URL=https://api.monteirodev.com
   ```

   A variável é lida **no build**. Se mudar o valor, faça um redeploy. Se ela faltar, o front aponta para `http://127.0.0.1:3333` sem avisar.
4. Faça o deploy. O roteamento é por hash (`#/chat`, `#/dashboard`), então não precisa de rewrites.
5. Opcional: em **Settings → Domains**, use um domínio próprio, por exemplo `monteirodev.com` ou `chat.monteirodev.com`.

---

## 7. Fechar o CORS e smoke test

### 7.1 CORS

No desktop, edite o `C:\my-profile-rag\api\.env` e troque o `CORS_ORIGIN` pelos domínios do front, separados por vírgula:

```env
CORS_ORIGIN="https://my-profile-rag.vercel.app,https://monteirodev.com"
```

Reinicie a API:

```powershell
nssm restart my-profile-rag
```

Cada preview da Vercel tem uma URL diferente. Para testar um preview específico, inclua a URL dele temporariamente.

### 7.2 Turnstile (anti-bot)

O chat só responde quando o navegador envia um token válido do Cloudflare Turnstile. O widget já existe, com a site key `0x4AAAAAAF1l53HTS-yZt_nU`, que fica no front em `web/src/config/turnstile.ts`.

1. No painel da Cloudflare, abra **Turnstile**, clique no widget e confira se a lista **Hostnames** tem os domínios do front, por exemplo `monteirodev.com`.
2. No mesmo widget, copie a **Secret key**. Ela não vai para o git nem para o front.
3. No desktop, edite o `C:\my-profile-rag\api\.env`:

   ```env
   TURNSTILE_SECRET="<secret key do widget>"
   TURNSTILE_HOSTNAMES="monteirodev.com,www.monteirodev.com"
   ```

   Use os mesmos domínios do passo 1, sem `localhost`.
4. Rode `nssm restart my-profile-rag`. Se as duas variáveis ficarem vazias, a API sobe sem a checagem e registra o aviso `Turnstile disabled` no log.

### 7.3 Smoke test

| Teste | Resultado esperado |
| --- | --- |
| Abrir o site e perguntar "Onde o Pedro trabalha?" | Resposta com dados do PDF, mostrando o passo `search_profile` |
| Abrir o Dashboard | A pergunta anterior aparece nos números |
| `curl -X POST https://api.monteirodev.com/api/chat/stream -H "content-type: application/json" -d '{"message":"oi"}'` | 403 com "Não foi possível confirmar que você é humano..." |
| Enviar 11 mensagens em menos de 1 minuto | A 11ª mostra "Muitas mensagens em pouco tempo. Aguarde um minuto." |
| Fechar o Ollama no desktop e perguntar algo | "O modelo local está offline no momento. Tente novamente mais tarde." |
| Reiniciar o desktop e esperar uns minutos | O chat volta a responder sem nenhuma ação manual |

---

## Manutenção

Os comandos abaixo rodam na pasta `C:\my-profile-rag\api`.

| Situação | Comando |
| --- | --- |
| Atualizar o código | `nssm stop my-profile-rag`, depois `git pull`, `npm ci` e `nssm start my-profile-rag` |
| Atualizar o perfil | trocar `data/Profile.pdf`, depois `npm run seed` (não precisa parar a API) |
| Ver os logs | `Get-Content logs\api.log -Tail 50 -Wait` |
| Status | `nssm status my-profile-rag`, `ollama ps` e o status do tunnel no painel da Cloudflare |
| Mudar o `.env` | editar o arquivo e rodar `nssm restart my-profile-rag` |

Pare o serviço antes do `npm ci`. No Windows, os arquivos nativos em uso (como os do `onnxruntime`) ficam travados, e a instalação falha com `EPERM`.

As conversas ficam na memória da API e somem quando ela reinicia. Os números do dashboard ficam no Neon e não se perdem.

---

## Referência de variáveis da API

| Variável | Valor no desktop | Descrição |
| --- | --- | --- |
| `LLM_PROVIDER` | `ollama` | O OpenRouter está desligado por enquanto |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama na mesma máquina |
| `OLLAMA_MODEL` | `qwen3:14b` | Modelo padrão |
| `ALLOWED_MODELS` | `ollama:qwen3:14b` | Lista `provider:model`. Vazia aceita só o modelo padrão |
| `EMBEDDING_MODEL` | `Xenova/all-MiniLM-L6-v2` | Precisa ser o mesmo usado no seed |
| `NEO4J_URI` | `neo4j+s://<ID>.databases.neo4j.io` | Aura |
| `NEO4J_USER` / `NEO4J_PASSWORD` | credenciais do Aura | |
| `NEO4J_DATABASE` | ID da instância do Aura | O padrão `neo4j` só serve para o Neo4j em Docker |
| `DATABASE_URL` | connection string do Neon | Precisa ter `?sslmode=require` |
| `API_HOST` | `127.0.0.1` | Só o tunnel acessa a API |
| `API_PORT` | `3333` | Precisa ser a mesma porta da rota do tunnel |
| `TRUST_PROXY_HOPS` | `1` | O `cloudflared` é o único proxy na frente da API |
| `CORS_ORIGIN` | domínios do front | `*` ou lista separada por vírgula |
| `TURNSTILE_SECRET` | secret key do widget | Vazia desliga a checagem anti-bot |
| `TURNSTILE_HOSTNAMES` | domínios do front | Precisa vir junto com o secret, sem `localhost` |
| `OLLAMA_CF_CLIENT_ID` / `OLLAMA_CF_CLIENT_SECRET` | não usar | Só para o Ollama em outra máquina, atrás de um tunnel |

---

## Problemas comuns

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| Seed ou API: `DatabaseNotFound` | `NEO4J_DATABASE` vazio ou errado | Usar o ID da instância do Aura (passo 1.1) |
| Seed: `ProcedureNotFound ... CYPHER 5` | Aura em Cypher 25 | Rodar o `ALTER DATABASE` do passo 1.1 |
| API: `Vector index "tensors_index" not found` | Seed não rodou nessa instância | Passo 3.4 |
| API não sobe e o log mostra `Invalid environment variables` | Variável vazia no `.env` | A mensagem diz qual. Preencher e reiniciar |
| Chat mostra "modelo local está offline" | Ollama fechado ou usuário deslogado | Passo 4.2; conferir com `ollama ps` |
| `https://api.monteirodev.com` retorna 502 ou 1033 | API parada ou tunnel desconectado | `nssm status my-profile-rag` e status do tunnel no painel |
| Toda mensagem volta "Não foi possível confirmar que você é humano" | Secret errado ou domínio do front fora do `TURNSTILE_HOSTNAMES` | Passo 7.2 |
| Erro de CORS no console do navegador | Domínio do front fora do `CORS_ORIGIN` | Passo 7.1 |
| "Modelo não disponível." | O front envia um modelo fora do `ALLOWED_MODELS` | Alinhar o primeiro modelo liberado em `web/src/config/models.ts` com o `ALLOWED_MODELS` |
| Respostas genéricas, sem dados do perfil | Modelo sem `tools` ou contexto cortado | Passo 2.3 e `OLLAMA_CONTEXT_LENGTH` |
| Rate limit atinge todo mundo ao mesmo tempo | `TRUST_PROXY_HOPS` errado: todos parecem ter o IP do tunnel | Passo 5.4 |
| `npm ci` falha com `EPERM` | Serviço rodando com arquivos travados | `nssm stop my-profile-rag` antes |
