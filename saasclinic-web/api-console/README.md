# SaasClinic — API Console

Console web estático estilo Postman/Insomnia para demonstrar o consumo das APIs do backend SaasClinic.

## Como rodar

Suba pelo menos um backend primeiro. Para demonstrar o switch, suba HOM e PROD em paralelo:

```bash
# HOM: gateway 8084, Dozzle 9998
docker compose --env-file ../.env.homologation \
  -f ../docker-compose.yml \
  -f ../docker-compose.homologation.yml \
  -f ../docker-compose.tools.yml \
  up --build -d

# PROD: gateway 8085, Dozzle 9999
docker compose --env-file ../.env.production \
  -f ../docker-compose.yml \
  -f ../docker-compose.production.yml \
  -f ../docker-compose.tools.yml \
  up --build -d
```

Sirva o console pela porta liberada no CORS do gateway:

```bash
cd saasclinic-api-console
python3 -m http.server 5174
# acesse http://localhost:5174
```

## Como usar

1. Use o toggle `HOM | PROD` no topo. O console aponta para `http://localhost:8084` em HOM e `http://localhost:8085` em PROD.
2. Faça login com `admin@clinica.com / admin123`.
3. O token JWT é armazenado por ambiente em `localStorage`, porque HOM e PROD usam `JWT_SECRET` diferentes.
4. Navegue pelos endpoints na sidebar ou rode os cenários rápidos.

## Features

- Catálogo de 30+ endpoints.
- Toggle HOM/PROD com tokens separados por ambiente.
- Auth Bearer automático após login.
- Path params e body templates editáveis.
- Response viewer com JSON, headers e timing.
- cURL preview/copy.
- Histórico das últimas 50 requisições.
- Cenários rápidos: smoke, caminho feliz, erros, Feign e cleanup.
- Tema claro/escuro.

## Estrutura

```text
index.html              # entry point
console-styles.css      # estilos
console-ui.jsx          # primitivos
console-catalog.jsx     # catálogo de endpoints e cenários
console-app.jsx         # topbar, login, endpoint panel, resposta
console-scenarios.jsx   # runner de cenários, histórico e welcome
```
