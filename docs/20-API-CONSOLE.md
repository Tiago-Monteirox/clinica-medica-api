# 20 — SaasClinic API Console (frontend de demonstração)

> SPA estática estilo Postman/Insomnia para consumir as APIs do backend ao vivo. Tem switch HOM/PROD que troca o gateway alvo em tempo real, mantendo dois ambientes rodando em paralelo.

Localização: [`saasclinic-api-console/`](../saasclinic-api-console/) na raiz do projeto.

---

## Stack

| | |
|---|---|
| Tipo | SPA "puro browser" — sem build system |
| React | 18 via CDN unpkg |
| JSX | compilado em runtime pelo Babel standalone |
| Estilos | CSS hand-written (`console-styles.css`) |
| Persistência | `localStorage` (env atual, tokens por ambiente, histórico, tema) |
| HTTP | `fetch` nativo |

Vantagem: zero dependências de build. Pode abrir o `index.html` direto ou servir com qualquer servidor estático. Funciona em qualquer máquina com browser moderno.

---

## Como rodar

### 1. Subir backend em HOM (porta 8084) e PROD (8085) em paralelo

Os dois ambientes precisam estar de pé pra o switch fazer sentido. Veja o doc [19 — Sanity Check](19-SANITY-CHECK.md) para o checklist.

```bash
# HOM (gateway :8084, mysql :3307, Dozzle :9998)
docker compose --env-file .env.homologation \
  -f docker-compose.yml \
  -f docker-compose.homologation.yml \
  -f docker-compose.tools.yml \
  up --build -d

# PROD (gateway :8085, 3 DBs :3308/:3309/:3310, Dozzle :9999) em PARALELO
docker compose --env-file .env.production \
  -f docker-compose.yml \
  -f docker-compose.production.yml \
  -f docker-compose.tools.yml \
  up --build -d
```

Conferir que ambos estão de pé:

```bash
docker compose ls | grep clinica
# clinica-homologation   running(6)
# clinica-production     running(8)
```

### 2. Servir o frontend

```bash
cd saasclinic-api-console
python3 -m http.server 5174
```

Abra no browser: <http://localhost:5174>

> **Importante**: a porta `5174` está na allow-list de CORS do gateway. Se servir em outra porta, ajuste `gateway/src/main/resources/application.yml` em `spring.cloud.gateway.server.webflux.globalcors`.

### 3. Usar

1. **Topbar** mostra o toggle `HOM | PROD`. Escolha qual ambiente atender. A baseURL muda automaticamente para `localhost:8084` (HOM) ou `localhost:8085` (PROD).
2. **Login** — `admin@clinica.com / admin123`. O token é guardado por ambiente em `localStorage` (`api-console-tokens`).
3. **Switch de ambiente** — clique no outro segmento. Se você já tinha logado naquele ambiente, o token é reaproveitado. Se não, faça login novamente.
4. **Sidebar** — escolha um endpoint, edite path params/body, clique "Enviar". A resposta aparece formatada à direita.
5. **Cenários** (ícone ⚡) — sequências pré-montadas (smoke, caminho feliz, erros, Feign).
6. **Histórico** (ícone 🕒) — últimas 50 requisições.

---

## Arquitetura do switch HOM/PROD

### Frontend

O estado central em `console-scenarios.jsx` mantém:

```js
const [env, setEnv] = useLocalStorage("api-console-env", "hom");
const baseUrl = ENVIRONMENTS[env].baseUrl;

// Tokens são POR-ambiente: JWT_SECRET de HOM não bate em PROD.
const [tokensByEnv, setTokensByEnv] = useLocalStorage("api-console-tokens", {});
const token = tokensByEnv[env] || null;
```

A constante `ENVIRONMENTS` em `console-app.jsx` mapeia:

```js
const ENVIRONMENTS = {
  hom:  { baseUrl: "http://localhost:8084", color: "#16a34a", ... },
  prod: { baseUrl: "http://localhost:8085", color: "#dc2626", ... },
};
```

Trocar o segmento HOM/PROD dispara:

1. `setEnv(nextEnv)` — atualiza estado e localStorage.
2. `baseUrl` é derivado automaticamente (não há `setBaseUrl` separado).
3. `token` muda automaticamente para `tokensByEnv[nextEnv]`.
4. Toast avisa: "Token reaproveitado" se já tinha login no novo ambiente, ou "Faça login (tokens são por-ambiente)".

### Backend (CORS)

O Spring Cloud Gateway tem `globalcors` ligado em `application.yml`:

```yaml
spring:
  cloud:
    gateway:
      server:
        webflux:
          globalcors:
            cors-configurations:
              '[/**]':
                allowedOrigins:
                  - "http://localhost:5174"
                  - "http://127.0.0.1:5174"
                  - "http://localhost:8000"
                  - "http://127.0.0.1:8000"
                  - "http://localhost:5500"
                  - "http://127.0.0.1:5500"
                allowedMethods: [GET, POST, PUT, PATCH, DELETE, OPTIONS]
                allowedHeaders: [Authorization, Content-Type, Accept, Origin, X-Requested-With, X-Request-Id]
                exposedHeaders: [Authorization]
                allowCredentials: true
                maxAge: 3600
```

Allow-list explícita; sem usar `*` (que é incompatível com `allowCredentials: true`).

Pra adicionar uma origem nova:

1. Edite `gateway/src/main/resources/application.yml`.
2. `mvn -pl gateway -am package -DskipTests`.
3. `docker compose ... up -d --build gateway` em cada ambiente que use.

### Por que tokens precisam ser por-ambiente

`JWT_SECRET` é diferente entre `.env.homologation` (string curta dev) e `.env.production` (gerada com `openssl rand -base64 64`). Tamanhos diferentes resultam em algoritmos diferentes:

- HOM: HS384 (secret de ~70 chars)
- PROD: HS512 (secret de 88 chars)

Um token assinado em um ambiente é rejeitado no outro com `JwtException: signature does not match`. O frontend trata isso guardando os tokens num mapa `{ hom: ..., prod: ... }`.

---

## Cenário de demonstração para banca

```text
00:00  Browser tab 1: localhost:5174   (Console)
00:00  Browser tab 2: localhost:9998   (Dozzle HOM)
00:00  Browser tab 3: localhost:9999   (Dozzle PROD)
00:00  DBeaver lateral com 4 conexões abertas (1 hom + 3 prod)

00:30  Console — toggle em "HOM" (verde). Login admin/admin123.
01:00  Console — POST /api/admin/v1/convenios { nome: "Demo HOM" }
01:15  Dozzle HOM (tab 2) — vê INFO Convênio Demo HOM criado (id=N)
01:30  DBeaver hom@:3307 — SELECT em convenios mostra a linha.

02:00  Console — toggle em "PROD" (vermelho). Toast: "faça login".
02:15  Login admin/admin123 (mesma credencial — usuário foi seedado em PROD também).
02:45  Console — POST /api/admin/v1/convenios { nome: "Demo PROD" }
03:00  Dozzle PROD (tab 3) — vê INFO Convênio Demo PROD criado.
03:15  DBeaver prod@:3308 — SELECT mostra a linha (banco DIFERENTE do hom).

03:30  Volta em HOM no toggle. Token de HOM ainda válido (no localStorage).
03:45  GET /api/admin/v1/convenios — mostra "Demo HOM" mas NÃO "Demo PROD".
04:00  Volta em PROD. GET /api/admin/v1/convenios — mostra "Demo PROD" mas NÃO "Demo HOM".

Mensagem central pra banca:
- Mesma codebase, dois ambientes vivos em paralelo.
- Dados isolados (bancos diferentes).
- Logs separados (Dozzles independentes).
- Tokens separados (segredos JWT diferentes).
- Tudo trocando com 1 click no toggle.
```

---

## Troubleshooting

### "Failed to fetch" / erro de CORS no console do browser

Causa mais comum: gateway não está aceitando seu Origin.

Conferir o que o gateway responde:

```bash
curl -i -X OPTIONS http://localhost:8084/auth/login \
  -H "Origin: http://localhost:5174" \
  -H "Access-Control-Request-Method: POST"
```

Espera `200` com `Access-Control-Allow-Origin: http://localhost:5174`. Se não vier, ver `application.yml` do gateway e rebuildar.

### Login retorna 200 mas requisições subsequentes dão 401

Você está enviando o token de HOM contra o gateway de PROD (ou vice-versa). Use o toggle pra forçar login no ambiente certo.

### "Loading…" eterno na primeira abertura do index.html

Babel standalone leva ~3-5s pra compilar os 4 .jsx em runtime na primeira vez. Normal — não é bug. Próximas aberturas usam cache do browser.

### Tela em branco com erros no console

Olhe o `console.error` do browser. Erro comum: `Cannot read properties of undefined (reading 'baseUrl')` — geralmente significa que `ENVIRONMENTS[env]` não existe (env corrompido no localStorage). Limpe com:

```js
// no console do browser
localStorage.removeItem("api-console-env");
localStorage.removeItem("api-console-tokens");
location.reload();
```

### Quero apontar pra um ambiente custom (staging, ngrok, etc)

Hoje o toggle só tem HOM/PROD hardcoded. Pra adicionar outro:

1. Edite `ENVIRONMENTS` em `saasclinic-api-console/console-app.jsx`:
   ```js
   const ENVIRONMENTS = {
     hom: { ... },
     prod: { ... },
     staging: { baseUrl: "https://staging.exemplo.com", color: "#eab308", ... },
   };
   ```
2. Adicione `segButton("staging")` no Topbar.
3. Adicione a origem do staging em `globalcors.allowedOrigins` se for chamar de fora.

---

## Arquivos

```
saasclinic-api-console/
├── index.html                  # entry, React + Babel via CDN
├── console-styles.css          # estilos
├── console-ui.jsx              # primitivos (Icon, Button, Input, JsonView…)
├── console-catalog.jsx         # 30+ endpoints + cenários pré-montados
├── console-app.jsx             # Topbar (toggle HOM/PROD), LoginModal,
│                                 EndpointPanel, ResponseView
└── console-scenarios.jsx       # ConsoleApp (root), ScenariosPanel,
                                  HistoryPanel, WelcomePanel
```

---

## Evoluções futuras

| Item | Por quê |
|---|---|
| Build com Vite + ESM | Hot reload, TypeScript, source maps. Hoje cada save no .jsx exige reload completo. |
| `@RestControllerAdvice` por serviço | Hoje o frontend depende do envelope `ApiResponse<T>` sempre estar lá. Documentar o contrato. |
| MDC com `X-Request-Id` | Console gera um UUID, manda no header; backend propaga via Feign; dá pra rastrear no Dozzle quem foi o autor. |
| OAuth/OIDC | Substituir login local por provider externo (Keycloak, Auth0). Token validation no gateway. |
