# SaasClinic — API Console

Console estilo Postman/Insomnia para demonstrar o consumo das APIs do backend SaasClinic.

## Como rodar

Abra o `index.html` em qualquer navegador moderno. É um app estático.

```bash
# opção 1: abrir direto
open index.html

# opção 2: servir via http
python3 -m http.server 5174
# acesse http://localhost:5174
```

## Como usar

1. **Suba o backend** primeiro:
   ```bash
   docker compose up -d
   curl http://localhost:8080/actuator/health
   ```

2. **Abra o Console** e configure a base URL no topo (padrão: `http://localhost:8080`)

3. **Faça login** clicando no botão "Login" no canto superior direito:
   - E-mail: `admin@clinica.com`
   - Senha: `admin123`
   - O token JWT é armazenado em `localStorage` e injetado automaticamente nas próximas requisições

4. **Navegue pelos endpoints** na sidebar, organizados por microsserviço:
   - **Autenticação** — `/auth/login`, `/auth/register`
   - **Administrativo** — Convênios, Pacientes, Médicos
   - **Agendamento** — CRUD + filtros por médico/paciente
   - **Atendimento** — registro clínico

5. **Cenários rápidos** (ícone ⚡ na sidebar) — sequências pré-montadas para demonstração:
   - **Smoke test** — login + listas básicas
   - **Caminho feliz** — fluxo completo: login → convênio → médico → paciente → agendamento → confirmação → atendimento
   - **Cenários de erro** — valida 401/404/422/400 do `GlobalExceptionHandler`
   - **Feign** — paciente inexistente, mostra propagação 404 via OpenFeign

## Features

- ✅ **Catálogo completo** de 30+ endpoints
- ✅ **Auth Bearer** automático após login
- ✅ **Path params** editáveis
- ✅ **Body templates** prontos por endpoint
- ✅ **Response viewer** com JSON syntax-highlighted, headers e timing
- ✅ **cURL preview/copy** — copie o comando equivalente
- ✅ **Histórico** das últimas 50 requisições (persistido)
- ✅ **Tema claro/escuro**

## Estrutura

```
index.html              ← entry point
console-styles.css      ← estilos do console
console-ui.jsx          ← primitivos (Icon, Button, Input, JsonView...)
console-catalog.jsx     ← catálogo de endpoints e cenários
console-app.jsx         ← componente principal (sidebar, request, response)
console-scenarios.jsx   ← runner de cenários + histórico + welcome
```

## Sem backend rodando

Se o backend não estiver no ar, você ainda pode:
- Ver o catálogo de endpoints
- Inspecionar os templates de body
- Copiar o cURL equivalente para usar em Insomnia/Postman/terminal

As requisições retornarão "Network Error" — basta subir o Gateway pra começar a usar.
