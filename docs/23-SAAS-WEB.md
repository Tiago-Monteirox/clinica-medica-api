# 23 — SaasClinic Web

> Frontend operacional do SaasClinic. Diferente do API Console, que é uma ferramenta técnica para testar endpoints, o SaaS Web é a interface de produto para uso por admin, recepcionista, médico e paciente.

Localização: [`saasclinic-web/`](../saasclinic-web/) na raiz do projeto. O API Console também é publicado dentro do SaaS Web em `/api-console/` para acesso pela tela inicial.

---

## Objetivo

Plugar o front estático recebido em `SaasClinic_frontend_completo/dist/saasclinic-frontend` nas rotas reais do backend atual, mantendo o API Console separado.

O app cobre:

- login e logout;
- dashboard por perfil;
- CRUD de convênios, médicos e pacientes;
- agendamentos com criação, confirmação, cancelamento e edição;
- atendimentos com registro clínico;
- prontuários, histórico clínico do paciente, templates clínicos e documentos emitidos;
- listagem de usuários e criação de usuário via `POST /auth/register`.

---

## Como rodar

Suba o backend em HOM e/ou PROD:

```bash
# HOM: gateway :8084

docker compose --env-file .env.homologation \
  -f docker-compose.yml \
  -f docker-compose.homologation.yml \
  -f docker-compose.tools.yml \
  up --build -d

# PROD: gateway :8085

docker compose --env-file .env.production \
  -f docker-compose.yml \
  -f docker-compose.production.yml \
  -f docker-compose.tools.yml \
  up --build -d
```

Sirva o SaaS Web em uma porta liberada no CORS do gateway. Use `8000` quando quiser manter o API Console em `5174`; se `8000` já estiver ocupada, `5174` também é suportada.

```bash
cd saasclinic-web
python3 -m http.server 8000
# abrir http://localhost:8000

# alternativa, se :8000 estiver ocupada
python3 -m http.server 5174
# abrir http://localhost:5174
```

Credencial inicial:

```text
admin@clinica.com / admin123
```

---

## Ambientes

O SaaS Web tem toggle HOM/PROD no painel **Tweaks**:

| Ambiente | Gateway | Observação |
|---|---|---|
| HOM | `http://localhost:8084` | ambiente principal de demonstração |
| PROD | `http://localhost:8085` | database-per-service local |

Tokens e usuário logado são armazenados por ambiente no `localStorage`. Logout chama `POST /auth/logout` no ambiente ativo e limpa apenas a sessão daquele ambiente.

---

## Rotas integradas

| Tela | Backend |
|---|---|
| Login | `POST /auth/login` |
| Logout | `POST /auth/logout` |
| Usuários | `GET /api/admin/v1/usuarios`, `POST /auth/register` |
| Convênios | `/api/admin/v1/convenios` |
| Médicos | `/api/admin/v1/medicos` |
| Pacientes | `/api/admin/v1/pacientes` |
| Agendamentos | `/api/agendamentos/v1/agendamentos` |
| Atendimentos | `/api/atendimentos/v1/atendimentos` |
| Prontuários | `/api/atendimentos/v1/prontuarios/**` |
| Templates clínicos | `/api/atendimentos/v1/templates-clinicos/**` |
| Documentos clínicos | `/api/atendimentos/v1/documentos-clinicos/**` |

O frontend faz unwrap do envelope `ApiResponse<T>` e normaliza diferenças de DTO, por exemplo `PacienteResponse.convenio.id` para `convenioId`.

---

## Ajustes importantes

- O backend atual expõe `GET /api/admin/v1/usuarios` e `POST /auth/register`; edição e exclusão de usuários ainda não existem em modo live.
- O backend não tem `PATCH /agendamentos/{id}/status`; confirmação/cancelamento usam `PUT /api/agendamentos/v1/agendamentos/{id}` com `{ status }`.
- Ao registrar atendimento, o frontend não força o status do agendamento. O `atendimento` publica evento RabbitMQ e o `agendamento` atualiza para `ATENDIDO` de forma assíncrona.
- A tela **Prontuários** é liberada para `ADMIN` e `MEDICO`. Escrita clínica e emissão de documentos ficam apenas para `MEDICO`; `ADMIN` visualiza.
- Acesso rápido por persona é completo no modo mock. No modo live, apenas ADMIN funciona com a seed padrão; outros perfis dependem de usuários reais criados no backend.

---

## Diferença para o API Console

| App | Uso |
|---|---|
| `saasclinic-api-console/` | ferramenta técnica para testar todas as APIs, cenários e cURL |
| `saasclinic-web/` | interface de produto para operar a clínica |
| `saasclinic-web/api-console/` | cópia estática do API Console acessível por `/api-console/` no mesmo servidor do SaaS Web |

Os 2 podem coexistir em portas separadas, mas o fluxo recomendado é servir o SaaS Web e acessar o console pela sub-rota `http://localhost:<porta>/api-console/`. Em desenvolvimento atual, isso fica em `http://localhost:5174/api-console/`.

---

## Checklist de validação

- [ ] `http://localhost:8000` ou `http://localhost:5174` abre sem erro de console crítico.
- [ ] `/api-console/` abre o API Console a partir da tela inicial do SaaS Web.
- [ ] Login ADMIN funciona em HOM.
- [ ] Toggle HOM/PROD troca gateway e sessão.
- [ ] CRUD de convênios, médicos e pacientes funciona com token ADMIN.
- [ ] Agendamento cria, confirma e cancela usando rotas reais.
- [ ] Atendimento registra prontuário e o status do agendamento muda depois do evento RabbitMQ.
- [x] Tela de prontuários abre em modo mock e live, carrega histórico e documentos.
- [ ] Tela de usuários lista contas via `/api/admin/v1/usuarios`, cria conta via `/auth/register` e deixa claro que edição/exclusão não existem no backend atual.
