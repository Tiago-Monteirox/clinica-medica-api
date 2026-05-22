# Clínica Médica — Sistema de Microsserviços

Sistema de gestão de clínica médica em arquitetura de microsserviços. Java 21, Spring Boot 3.3, Spring Cloud Gateway, MySQL 8, comunicação via OpenFeign, autenticação JWT, deploy com Docker Compose.

---

## Arquitetura

```
                         ┌──────────────────────────┐
                         │     Cliente / Front      │
                         └────────────┬─────────────┘
                                      ▼
                       ┌────────────────────────────┐
                       │   API Gateway (8080)       │
                       │   Spring Cloud Gateway     │
                       │   + Filtro JWT (WebFlux)   │
                       └─┬──────────┬──────────┬───┘
                         │          │          │
       ┌─────────────────┘          │          └────────────────┐
       ▼                            ▼                           ▼
┌────────────────┐          ┌────────────────┐          ┌────────────────┐
│ administrativo │◄──Feign──│  agendamento   │◄──Feign──│  atendimento   │
│     (8081)     │          │     (8082)     │          │     (8083)     │
└────────┬───────┘          └────────┬───────┘          └────────┬───────┘
         │                           │                           │
         └─────────── MySQL 8.3 (clinica-mysql:3307) ─────────────┘
                     ├─ clinica_administrativo
                     ├─ clinica_agendamento
                     └─ clinica_atendimento
```

Cada microsserviço tem **sua própria base lógica** dentro de uma instância MySQL compartilhada (database-per-service, didático). A comunicação entre serviços é feita exclusivamente via HTTP/REST com **OpenFeign** declarativo + `ErrorDecoder` que traduz HTTP em exceções de negócio. O Gateway é a única porta pública e centraliza autenticação JWT.

> **Nota de porta:** o gateway escuta `8080` dentro do container, publicado como **`8084`** no host (`docker-compose.yml`) para não conflitar com aplicações locais. Em ambiente limpo basta trocar para `8080:8080`.

---

## Módulos

| Módulo | Porta (host) | Responsabilidade |
|---|---|---|
| `commons` | — | Biblioteca técnica: `ApiResponse<T>`, `GlobalExceptionHandler`, exceções base, `CommonsAutoConfiguration` (SPI) |
| `administrativo` | **8081** | CRUD de Convênio, Paciente, Médico. Auth + JWT + Spring Security. Fonte de verdade para `/exists` consumidos via Feign |
| `agendamento` | **8082** | CRUD de Agendamento. Valida paciente/médico via Feign no administrativo |
| `atendimento` | **8083** | Registro clínico (diagnóstico + prescrição). Valida agendamento via Feign |
| `gateway` | **8084** → 8080 | Roteamento + filtro JWT centralizado |

---

## Stack

| Categoria | Tecnologia | Versão |
|---|---|---|
| Linguagem | Java | 21 |
| Framework | Spring Boot | 3.3.5 |
| Microsserviços | Spring Cloud | 2023.0.3 |
| Persistência | Spring Data JPA + Hibernate | 6.5 |
| Banco | MySQL | 8.3 |
| Comunicação | OpenFeign | Spring Cloud |
| Gateway | Spring Cloud Gateway (WebFlux) | 4.x |
| Documentação | SpringDoc OpenAPI (Swagger UI) | 2.6 |
| Logging HTTP | Logbook (Zalando) | 3.9 |
| Mapeamento | ModelMapper | 3.2 |
| Validação | Bean Validation (Jakarta) | — |
| Segurança | Spring Security + JJWT | 6.x / 0.12.6 |
| Testes (unit) | JUnit 5 + Mockito | — |
| Testes (integração) | Testcontainers | 1.20 |
| Build | Maven multi-módulo | 3.9 |
| Container | Docker + Docker Compose | — |

---

## Pré-requisitos

| Ferramenta | Versão mínima |
|---|---|
| Java | 21 |
| Maven | 3.9 |
| Docker + Docker Compose | 24 / 2.x |

---

## Como rodar

### Opção A — Docker Compose (recomendado)

```bash
# Sobe MySQL + administrativo + agendamento + atendimento + gateway
docker compose up --build -d

# Acompanhar logs
docker compose logs -f

# Derrubar (mantém volumes)
docker compose down

# Derrubar e apagar dados
docker compose down -v
```

Endpoints após o boot:

- **Gateway**: `http://localhost:8084` (entrada única — login + roteamento)
- Swagger administrativo: `http://localhost:8081/swagger-ui.html`
- Swagger agendamento: `http://localhost:8082/swagger-ui.html`
- Swagger atendimento: `http://localhost:8083/swagger-ui.html`

### Opção B — Local (IDE / terminal)

```bash
# 1. Subir só o MySQL
docker compose up -d mysql

# 2. Instalar commons (necessário só na primeira vez)
mvn clean install -pl commons -am

# 3. Em terminais separados
mvn spring-boot:run -pl administrativo
mvn spring-boot:run -pl agendamento
mvn spring-boot:run -pl atendimento
mvn spring-boot:run -pl gateway
```

---

## Smoke test (fluxo completo via Gateway)

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:8084/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clinica.com","senha":"admin123"}' | jq -r '.data.token')

# 2. Criar dados mestres
curl -s -X POST http://localhost:8084/api/admin/v1/convenios \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"nome":"Unimed","descricao":"Plano Ouro"}'

curl -s -X POST http://localhost:8084/api/admin/v1/medicos \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"nome":"Dra. Ana","email":"ana@clinica.com","crm":"CRM/SP 99","especialidade":"Cardiologia"}'

curl -s -X POST http://localhost:8084/api/admin/v1/pacientes \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"nome":"João Silva","email":"joao@email.com","cpf":"12345678901","convenioId":1}'

# 3. Criar agendamento (cruza serviços via Feign)
curl -s -X POST http://localhost:8084/api/agendamentos/v1/agendamentos \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"pacienteId":1,"medicoId":1,"dataHora":"2030-06-15T14:00:00"}'

# 4. Registrar atendimento
curl -s -X POST http://localhost:8084/api/atendimentos/v1/atendimentos \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"agendamentoId":1,"diagnostico":"Hipertensão","prescricao":"Losartana 50mg"}'
```

Credenciais iniciais (seed do `administrativo`): `admin@clinica.com` / `admin123`.

---

## Roles & autorização

Mapa de atores aplicado via `@PreAuthorize` nos controllers:

| Recurso | GET | POST/PUT | DELETE |
|---|---|---|---|
| `/v1/convenios` | ADMIN, RECEPCIONISTA, MEDICO | ADMIN | ADMIN |
| `/v1/medicos` | ADMIN, RECEPCIONISTA, MEDICO | ADMIN | ADMIN |
| `/v1/pacientes` | ADMIN, RECEPCIONISTA, MEDICO | ADMIN, RECEPCIONISTA | ADMIN |
| `/v1/agendamentos` (POST/PUT) | — | ADMIN, RECEPCIONISTA | — |
| `/v1/agendamentos/{id}` (GET) | ADMIN, RECEPCIONISTA, MEDICO, PACIENTE | — | ADMIN, RECEPCIONISTA, PACIENTE |
| `/v1/atendimentos` (POST/PUT) | — | ADMIN, MEDICO | — |
| `/v1/atendimentos` (DELETE) | — | — | ADMIN |
| `/auth/register` | — | ADMIN | — |

Endpoints **públicos** (sem JWT): `/auth/login`, `/v1/medicos/{id}/exists`, `/v1/pacientes/{id}/exists` (Feign interno), `/actuator/health`, `/v3/api-docs/**`, `/swagger-ui/**`.

---

## Testes

```bash
# Todos os módulos
mvn test

# Módulo específico
mvn test -pl administrativo
```

Estado atual: **29 testes unitários verdes** distribuídos em ConvenioServiceTest (8), MedicoServiceTest (5), PacienteServiceTest (5), AgendamentoServiceTest (6), AtendimentoServiceTest (5).

---

## Documentação

| # | Documento | Descrição |
|---|---|---|
| 00 | [Visão Geral](docs/00-VISAO-GERAL.md) | Domínio, atores, escopo MVP, decisões de produto |
| 01 | [Arquitetura](docs/01-ARQUITETURA.md) | Diagrama, comunicação, fluxo de uma requisição |
| 02 | [Roteiro de Implementação](docs/02-ROTEIRO.md) | Passo a passo (PASSOs 0 → 15) |
| 03 | [Módulo `commons`](docs/03-COMMONS.md) | Biblioteca técnica compartilhada |
| 04 | [Serviço `administrativo`](docs/04-ADMINISTRATIVO.md) | Convênio, Paciente, Médico, Auth |
| 05 | [Serviço `agendamento`](docs/05-AGENDAMENTO.md) | Agendamento + Feign |
| 06 | [Serviço `atendimento`](docs/06-ATENDIMENTO.md) | Atendimento + diagnóstico + prescrição |
| 07 | [API Gateway](docs/07-GATEWAY.md) | Spring Cloud Gateway, rotas |
| 08 | [Segurança (JWT)](docs/08-SEGURANCA.md) | Autenticação e autorização |
| 09 | [Docker](docs/09-DOCKER.md) | Dockerfile multi-stage, docker-compose |
| 10 | [CI/CD com GitHub Actions](docs/10-CICD.md) | Pipeline (pendente — ver PASSO 15) |
| 11 | [Testes](docs/11-TESTES.md) | JUnit, Mockito, Testcontainers |
| 12 | [Referência de Tecnologias](docs/12-TECNOLOGIAS.md) | Aprofundamento técnico |
| 13 | [Ambientes e Wireframes (proposta)](docs/13-AMBIENTES-E-WIREFRAMES.md) | Proposta inicial — frontend adiado, Kubernetes substituído pelo doc 14 |
| 14 | [Conteinerização por Ambiente](docs/14-CONTEINERIZACAO-AMBIENTES.md) | Docker Compose: `homologation` (1 MySQL, 3 schemas) e `production` (3 bancos externos) |
| 15 | [CI/CD com GitHub Actions](docs/15-CICD-GITHUB-ACTIONS.md) | Pipeline `mvn test` + build dos JARs + push das imagens para o GHCR |
| 16 | [Frontend — Esboço](docs/16-FRONTEND.md) | SPA React + Vite + shadcn (input para o design) |
| 17 | [Ambientes — Tradeoffs](docs/17-AMBIENTES-TRADEOFFS.md) | Justificativa de homologation × production para apresentação; FAQ pra banca |
| — | [**CHECKPOINT**](docs/CHECKPOINT.md) | **Estado atual: PASSOS 0–14 concluídos. Validações executadas. Pendências.** |

---

## Estado atual

| PASSO | Tema | Status |
|---|---|---|
| 0 | Diagnóstico inicial | ✅ |
| 1 | `commons` em biblioteca técnica (auto-configuration) | ✅ |
| 2 | `administrativo` — pom + application.yml | ✅ |
| 3 | Convênio | ✅ |
| 4 | Médico | ✅ |
| 5 | Paciente (FK opcional para Convênio) | ✅ |
| 6 | Auth + emissão JWT | ✅ |
| 7 | Spring Security + `@PreAuthorize` em todos os controllers | ✅ |
| 8 | Checkpoint administrativo ponta a ponta | ✅ |
| 9 | `administrativo` em container Docker | ✅ |
| 10 | `agendamento` + Feign + ErrorDecoder | ✅ |
| 11 | `atendimento` + Feign + denormalização | ✅ |
| 12 | API Gateway (Spring Cloud Gateway, WebFlux) | ✅ |
| 13 | Stack Docker completa (5 containers) | ✅ |
| 14 | Testes unitários (29 verdes) | ✅ |
| 15 | CI/CD + polimento (JaCoCo, GitHub Actions, badges) | ⏳ |

Detalhes, decisões técnicas, desvios em relação ao roteiro e validações executadas em [`docs/CHECKPOINT.md`](docs/CHECKPOINT.md).

---

## Próximos passos

1. **PASSO 15 — CI/CD e polimento**: `.github/workflows/ci.yml` (build + test em PR/push), `docker.yml` (push para GHCR), JaCoCo para cobertura, badges no README.
2. **Frontend**: SPA React + Vite consumindo o gateway (`docs/16-FRONTEND.md`). Esboço pronto para entrar no design.
3. **Kubernetes**: deploy em K8s seguindo `docs/14-KUBERNETES-AMBIENTES.md` e `docs/15-KUBERNETES-GUIA-IMPLEMENTACAO.md`.
