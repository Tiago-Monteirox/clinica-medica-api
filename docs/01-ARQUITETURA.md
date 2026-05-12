# 01 — Arquitetura

> Tempo de leitura: ~15 minutos

## Visão de alto nível

```
                       ┌──────────────────────────────────┐
                       │      Cliente (Postman / Web)     │
                       └─────────────────┬────────────────┘
                                         │
                                  Bearer JWT
                                         ▼
                  ┌──────────────────────────────────────────┐
                  │           API GATEWAY  (porta 8080)       │
                  │     Spring Cloud Gateway + JwtFilter      │
                  │   /api/admin/**     → administrativo      │
                  │   /api/agendamentos/** → agendamento      │
                  │   /api/atendimentos/** → atendimento      │
                  │   /auth/login        → administrativo      │
                  └──┬─────────────────┬──────────────────┬──┘
                     │                 │                  │
                     ▼                 ▼                  ▼
       ┌─────────────────────┐ ┌────────────────┐ ┌────────────────┐
       │   ADMINISTRATIVO    │ │  AGENDAMENTO   │ │  ATENDIMENTO   │
       │      (8081)         │ │     (8082)     │ │     (8083)     │
       │                     │ │                │ │                │
       │  • Convenio         │ │  • Agendamento │ │  • Atendimento │
       │  • Paciente         │ │                │ │                │
       │  • Medico           │ │   ┌─Feign──┐   │ │  ┌─Feign──┐    │
       │  • Auth (login)     │ │   │ admin  │   │ │  │ agend  │    │
       │                     │ │   └────────┘   │ │  └────────┘    │
       │   Swagger /v3/api-docs ─────────────────────────────────► │
       └──────────┬──────────┘ └────────┬───────┘ └────────┬───────┘
                  │                     │                  │
                  ▼                     ▼                  ▼
          ┌──────────────┐      ┌──────────────┐    ┌──────────────┐
          │   MySQL 8    │      │   MySQL 8    │    │   MySQL 8    │
          │  3307 :3306  │      │  3308 :3306  │    │  3309 :3306  │
          │ administrativo │    │  agendamento │    │  atendimento │
          └──────────────┘      └──────────────┘    └──────────────┘
```

---

## Princípios arquiteturais

1. **Separação por domínio (bounded context).** Cada serviço é dono do seu modelo e do seu banco.
2. **Database-per-service.** Sem foreign keys cruzando bancos; integridade garantida na camada de aplicação.
3. **Comunicação síncrona via REST + Feign.** Para o MVP basta; mensageria fica como evolução.
4. **Gateway é a única porta de entrada externa.** Microsserviços só são acessíveis diretamente em desenvolvimento.
5. **JWT carrega a identidade.** Os serviços downstream confiam no token validado pelo Gateway, mas também o validam localmente (defesa em profundidade).
6. **Stateless.** Nenhum serviço guarda sessão; toda autenticação é via token.
7. **Commons como biblioteca técnica.** Não compartilha entidades de domínio entre serviços (cada um define as suas), apenas utilitários transversais.

---

## Camadas dentro de cada microsserviço

```
┌──────────────────────────────────────────────────────┐
│  controller/   ← @RestController, recebe HTTP         │
├──────────────────────────────────────────────────────┤
│  dto/          ← Request, Response, DTOs internos    │
├──────────────────────────────────────────────────────┤
│  service/      ← regras de negócio, @Transactional   │
├──────────────────────────────────────────────────────┤
│  repository/   ← JpaRepository, queries              │
├──────────────────────────────────────────────────────┤
│  entity/       ← @Entity, mapeamento JPA             │
├──────────────────────────────────────────────────────┤
│  client/       ← @FeignClient (apenas onde precisa)  │
├──────────────────────────────────────────────────────┤
│  config/       ← FeignConfig, SwaggerConfig, etc.    │
└──────────────────────────────────────────────────────┘
```

Em cima de tudo, do `commons` herda-se: `ApiResponse<T>`, `GlobalExceptionHandler`, exceções base, DTOs de contrato (CustomerDTO equivalente para Paciente, etc. — ver [`03-COMMONS.md`](03-COMMONS.md)).

---

## Comunicação entre serviços

| Origem | Destino | Endpoint chamado | Quando |
|---|---|---|---|
| `agendamento` | `administrativo` | `GET /api/v1/pacientes/{id}/exists` | Ao criar agendamento |
| `agendamento` | `administrativo` | `GET /api/v1/medicos/{id}/exists` | Ao criar agendamento |
| `atendimento` | `agendamento` | `GET /api/v1/agendamentos/{id}` | Ao registrar atendimento |
| `gateway` | `administrativo` | `POST /auth/login` | Login do usuário |

**Tradução de erros:** o `FeignConfig` registra um `ErrorDecoder` que converte:

- `404` → `EntityNotFoundException` no chamador
- `422` → `BusinessException`
- `5xx` ou conexão recusada → `FeignIntegrationException` (resposta `502 Bad Gateway` para o cliente)

Os três tipos são definidos no `commons`.

---

## Fluxo completo: criar um agendamento

Sequência detalhada para entender como as peças se encaixam:

```
1. Cliente → POST /api/agendamentos/v1/agendamentos
             Authorization: Bearer eyJ...
             Body: { pacienteId, medicoId, dataHora }

2. Gateway recebe a requisição
   ├─ JwtAuthenticationFilter valida assinatura do token
   ├─ Extrai roles do claim "roles"
   ├─ Aplica regra: rota exige role RECEPCIONISTA ou ADMIN
   └─ Roteia para http://agendamento:8082/v1/agendamentos
      (header X-User-Id é injetado a partir do "sub" do JWT)

3. agendamento-service recebe POST /v1/agendamentos
   ├─ Logbook loga a requisição (DEBUG)
   ├─ AgendamentoController invoca AgendamentoService.criar(request)
   ├─ Service chama AdministrativoClient.pacienteExiste(pacienteId)
   │   ├─ Feign emite GET http://administrativo:8081/v1/pacientes/42/exists
   │   ├─ administrativo-service responde 200 { "exists": true }
   │   └─ se false → throw EntityNotFoundException("Paciente 42 não encontrado")
   ├─ Service chama AdministrativoClient.medicoExiste(medicoId)
   │   └─ idem para médico
   ├─ Service valida dataHora (não pode ser passada, não pode conflitar com outra agenda do médico)
   ├─ Service salva via AgendamentoRepository.save(entity)
   └─ Service retorna AgendamentoResponse mapeado pelo ModelMapper

4. Controller envelopa em ApiResponse.success("Agendamento criado", response, 201)
   └─ Retorna 201 Created com body JSON

5. GlobalExceptionHandler intercepta qualquer exceção:
   ├─ EntityNotFoundException → 404 + ApiResponse.error(...)
   ├─ MethodArgumentNotValidException → 400 com lista de campos inválidos
   ├─ BusinessException → 422
   ├─ FeignIntegrationException → 502
   └─ Exception genérica → 500
```

---

## Portas e endpoints

| Serviço | Porta interna (container) | Porta externa (host) | Base path no Gateway |
|---|---|---|---|
| gateway | 8080 | 8080 | — |
| administrativo | 8081 | 8081 | `/api/admin/**` |
| agendamento | 8082 | 8082 | `/api/agendamentos/**` |
| atendimento | 8083 | 8083 | `/api/atendimentos/**` |
| MySQL administrativo | 3306 | 3307 | — |
| MySQL agendamento | 3306 | 3308 | — |
| MySQL atendimento | 3306 | 3309 | — |

> O acesso direto aos microsserviços (8081/8082/8083) é mantido apenas para desenvolvimento e Swagger. Em produção, só o Gateway estaria exposto.

---

## Estratégia de configuração

Cada serviço usa `application.yml` (recomendado migrar das `application.properties` atuais) com:

- **Defaults** funcionais para `localhost` (rodar em IDE).
- **Variáveis de ambiente** com defaults: `${DB_HOST:localhost}`, `${DB_PORT:3306}`, `${ADMINISTRATIVO_URL:http://localhost:8081}`.

O mesmo JAR roda em qualquer ambiente — só muda o que vem por env. No Docker Compose, as envs são injetadas no bloco `environment:` de cada serviço.

---

## Decisões registradas

### ADR-001 — Database-per-service

**Status:** Aceito.
**Contexto:** O docker-compose inicial tinha um MySQL único.
**Decisão:** Migrar para 3 instâncias MySQL (uma por serviço).
**Consequências:** Maior consumo de memória local (~3× MySQL), mas alinhamento com o padrão real de microsserviços e com o exemplo `app-order-service`.

### ADR-002 — JWT próprio em vez de Keycloak

**Status:** Aceito.
**Contexto:** O guia original (IMPL_GUIDE_PT2) propunha Keycloak.
**Decisão:** Usar Spring Security + JJWT para emitir/validar tokens próprios.
**Consequências:** Menos um container; mais código para manter; suficiente para o escopo didático. Migração para Keycloak fica documentada como evolução.

### ADR-003 — Feign em vez de RestTemplate

**Status:** Aceito.
**Contexto:** IMPL_GUIDE_PT2 usa `RestTemplate`.
**Decisão:** Usar OpenFeign declarativo.
**Consequências:** Código de cliente reduzido (interface + anotações); `ErrorDecoder` centraliza tradução de erros; alinhado ao `app-order-service`.

### ADR-004 — Convênio em `administrativo` (não em `commons`)

**Status:** Aceito.
**Contexto:** Hoje o `Convenio` está dentro do `commons`.
**Decisão:** Migrar para `administrativo`. O `commons` deixa de ter entidades de domínio.
**Consequências:** Refatoração necessária. O `commons` passa a ser **biblioteca técnica pura** (sem JPA Entity).

---

## Próximo passo

[`02-ROTEIRO.md`](02-ROTEIRO.md) — passo a passo da implementação.
