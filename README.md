# Clínica Médica — Sistema de Microsserviços

Sistema de gestão de clínica médica construído com arquitetura de microsserviços. Java 21, Spring Boot 3.3, MySQL 8, comunicação via OpenFeign, autenticação JWT, deploy com Docker Compose e pipeline em GitHub Actions.

> Projeto integrador da disciplina. Esta é a base oficial — substitui versões anteriores no Desktop.

---

## Arquitetura

```
                            ┌─────────────────────┐
                            │   Cliente / Front   │
                            └──────────┬──────────┘
                                       │
                                       ▼
                          ┌────────────────────────┐
                          │   API Gateway (8080)   │
                          │  Spring Cloud Gateway  │
                          │   + Filtro JWT         │
                          └─┬──────────┬──────────┬┘
                            │          │          │
        ┌───────────────────┘          │          └────────────────────┐
        ▼                              ▼                               ▼
┌────────────────┐            ┌────────────────┐             ┌────────────────┐
│ administrativo │◄───Feign───┤  agendamento   │◄────Feign───┤  atendimento   │
│     (8081)     │            │     (8082)     │             │     (8083)     │
└────────┬───────┘            └────────┬───────┘             └────────┬───────┘
         │                             │                              │
         ▼                             ▼                              ▼
   ┌──────────┐                  ┌──────────┐                   ┌──────────┐
   │  MySQL   │                  │  MySQL   │                   │  MySQL   │
   │  (3307)  │                  │  (3308)  │                   │  (3309)  │
   └──────────┘                  └──────────┘                   └──────────┘
```

Cada microsserviço tem **seu próprio banco** (database-per-service). A comunicação é feita exclusivamente via HTTP/REST com **OpenFeign** declarativo. O Gateway é a única porta de entrada e centraliza autenticação JWT.

---

## Módulos

| Módulo | Porta | Responsabilidade |
|---|---|---|
| `commons` | — | Biblioteca técnica compartilhada: `ApiResponse<T>`, `GlobalExceptionHandler`, exceções base, DTOs de contrato, auto-configuration |
| `administrativo` | **8081** | CRUD de Convênio, Paciente e Médico. Fonte de verdade para validações vindas dos outros serviços |
| `agendamento` | **8082** | CRUD de Agendamento. Valida paciente/médico via Feign no `administrativo` |
| `atendimento` | **8083** | CRUD de Atendimento. Registra diagnóstico/prescrição. Valida agendamento via Feign |
| `gateway` | **8080** | Roteamento + filtro JWT. Spring Cloud Gateway |

---

## Stack

| Categoria | Tecnologia | Versão |
|---|---|---|
| Linguagem | Java | 21 |
| Framework | Spring Boot | 3.3.5 |
| Microsserviços | Spring Cloud | 2023.0.x |
| Persistência | Spring Data JPA + Hibernate | — |
| Banco | MySQL | 8 |
| Comunicação | OpenFeign | Spring Cloud |
| Documentação | SpringDoc OpenAPI (Swagger UI) | 2.x |
| Logging HTTP | Logbook (Zalando) | 3.x |
| Mapeamento | ModelMapper | 3.2.x |
| Validação | Bean Validation (Jakarta) | — |
| Segurança | Spring Security + JJWT | 6.x / 0.12.x |
| Testes (unit) | JUnit 5 + Mockito + AssertJ | — |
| Testes (integração) | Testcontainers + MockMvc | — |
| Build | Maven multi-módulo | 3.9 |
| Container | Docker + Docker Compose | — |
| CI/CD | GitHub Actions | — |

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

Sobe os 3 MySQLs, os 3 microsserviços e o gateway de uma vez.

```bash
# 1. Gerar os JARs
mvn clean package -DskipTests

# 2. Subir toda a stack
docker compose up --build
```

Endpoints disponíveis após o boot:

- API Gateway: `http://localhost:8080`
- Swagger administrativo: `http://localhost:8081/swagger-ui.html`
- Swagger agendamento: `http://localhost:8082/swagger-ui.html`
- Swagger atendimento: `http://localhost:8083/swagger-ui.html`

```bash
# Derrubar tudo (mantém volumes)
docker compose down

# Derrubar e apagar dados dos bancos
docker compose down -v
```

### Opção B — Local (IDE / terminal)

Pré-requisito: MySQL rodando na porta `3307` (use `docker compose up -d mysql` para subir só o banco).

```bash
# 1. Instalar commons no repositório local Maven
mvn clean install -pl commons

# 2. Em terminais separados (na ordem do roteiro):
mvn spring-boot:run -pl administrativo
mvn spring-boot:run -pl agendamento
mvn spring-boot:run -pl atendimento
mvn spring-boot:run -pl gateway
```

---

## Documentação

A documentação completa está em [`docs/`](docs/). Comece pelo índice abaixo:

| # | Documento | Descrição |
|---|---|---|
| 00 | [Visão Geral](docs/00-VISAO-GERAL.md) | Domínio, atores, escopo MVP, decisões de produto |
| 01 | [Arquitetura](docs/01-ARQUITETURA.md) | Diagrama, comunicação, fluxo de uma requisição |
| 02 | [Roteiro de Implementação](docs/02-ROTEIRO.md) | **Comece por aqui.** Passo-a-passo em fases (0 a 7) |
| 03 | [Módulo `commons`](docs/03-COMMONS.md) | Refatoração para biblioteca técnica |
| 04 | [Serviço `administrativo`](docs/04-ADMINISTRATIVO.md) | Convênio, Paciente, Médico |
| 05 | [Serviço `agendamento`](docs/05-AGENDAMENTO.md) | Agendamento + Feign para administrativo |
| 06 | [Serviço `atendimento`](docs/06-ATENDIMENTO.md) | Atendimento + diagnóstico + prescrição |
| 07 | [API Gateway](docs/07-GATEWAY.md) | Spring Cloud Gateway, rotas |
| 08 | [Segurança (JWT)](docs/08-SEGURANCA.md) | Autenticação, autorização por role |
| 09 | [Docker](docs/09-DOCKER.md) | Dockerfile multi-stage, docker-compose |
| 10 | [CI/CD com GitHub Actions](docs/10-CICD.md) | Visão geral do pipeline — implementação detalhada no PASSO 15 |
| 11 | [Testes](docs/11-TESTES.md) | JUnit, Mockito, Testcontainers, MockMvc |
| 12 | [Referência de Tecnologias](docs/12-TECNOLOGIAS.md) | Aprofundamento técnico de cada peça |
| 13 | [Ambientes e Wireframes (proposta)](docs/13-AMBIENTES-E-WIREFRAMES.md) | Proposta inicial — frontend adiado, Kubernetes substituído pelo doc 14 |
| 14 | [Conteinerização por Ambiente](docs/14-CONTEINERIZACAO-AMBIENTES.md) | Docker Compose: `homologation` (1 MySQL, 3 schemas) e `production` (3 bancos externos) |
| 15 | [CI/CD com GitHub Actions](docs/15-CICD-GITHUB-ACTIONS.md) | Pipeline `mvn test` + build dos JARs + push das imagens para o GHCR |
| 16 | [Frontend — Esboço](docs/16-FRONTEND.md) | SPA React + Vite + shadcn (input para o design) |
| 17 | [Ambientes — Tradeoffs](docs/17-AMBIENTES-TRADEOFFS.md) | Justificativa de homologation × production para apresentação; FAQ pra banca |
| — | [**CHECKPOINT**](docs/CHECKPOINT.md) | **Estado atual: PASSOS 0–14 concluídos. Validações executadas. Pendências.** |

Diagramas PlantUML em [`docs/diagramas/`](docs/diagramas/).

---

## Fluxo recomendado para o aluno

1. Ler [`docs/00-VISAO-GERAL.md`](docs/00-VISAO-GERAL.md) e [`docs/01-ARQUITETURA.md`](docs/01-ARQUITETURA.md) (≈30 min).
2. Seguir o [`docs/02-ROTEIRO.md`](docs/02-ROTEIRO.md) fase por fase, consultando o doc específico de cada módulo conforme aparece.
3. Usar [`docs/12-TECNOLOGIAS.md`](docs/12-TECNOLOGIAS.md) como referência sempre que aparecer uma dependência ou anotação que não conhece.

---

## Estado atual do código

### Progresso dos PASSOs

| PASSO | Descrição | Status |
|---|---|---|
| 0 | Diagnóstico inicial | ✅ |
| 1 | `commons` refatorado em biblioteca técnica | ✅ |
| 2 | `administrativo` — pom.xml + application.yml | ✅ |
| 3 | Convênio (CRUD + ApiResponse) | ✅ |
| 4 | Médico | 🔲 |
| 5 | Paciente | 🔲 |
| 6 | Auth + JWT | 🔲 |
| 7 | Spring Security | 🔲 |
| 8–15 | Agendamento, Atendimento, Gateway, Docker, Testes, CI/CD | 🔲 |

---

### O que já está implementado

**Infraestrutura**
- `Dockerfile` multi-stage parametrizado (`ARG MODULE`) — único arquivo para todos os módulos
- `docker-compose.yml` com MySQL 8.3, healthcheck e rede isolada; agendamento/atendimento comentados até implementação
- `sql/init.sql` — cria as 3 bases e todas as tabelas com constraints
- `.dockerignore`, `.env.example`

**`pom.xml` raiz**
- Java 21, Spring Boot 3.3.5, versões centralizadas: JJWT 0.12.6, SpringDoc 2.6.0, Logbook 3.9.0, Testcontainers 1.20.4
- `maven-surefire-plugin` 3.3.1 (suporte a JUnit 5)

**Módulo `commons`** *(PASSO 1 — biblioteca técnica pura)*
- `ApiResponse<T>` com `@JsonInclude(NON_NULL)` — wrapper padrão de todas as respostas
- `BusinessException` (422), `EntityNotFoundException` (404), `FeignIntegrationException` (502)
- `GlobalExceptionHandler` — captura exceções e retorna `ApiResponse` padronizado
- `CommonsAutoConfiguration` + SPI — beans ativados automaticamente em qualquer módulo que declare `commons`

**Módulo `administrativo`** *(PASSO 3 — Convênio completo)*
- Package by feature: classes organizadas em `convenio/`, `shared/dto/`
- CRUD completo de Convênio: `ConvenioEntity` (com `@Builder`, `createdAt`/`updatedAt`), `ConvenioRepository`, `ConvenioService` (lança exceções, nunca retorna Optional), `ConvenioController` (wrapping com `ApiResponse<T>`, Swagger `@Tag`/`@Operation`)
- `application.yml` com variáveis de ambiente e fallbacks para dev local
- Dependências: Spring Security, JJWT, SpringDoc, Logbook, Actuator, Testcontainers
- 8 testes unitários passando (`ConvenioServiceTest` com builder pattern)

**Módulos `agendamento` e `atendimento`** — classe `Application` apenas

---

### A ser feito

Seguir o [`docs/02-ROTEIRO.md`](docs/02-ROTEIRO.md) a partir do **PASSO 4 (Médico)**.
Cada PASSO tem code blocks completos prontos para copiar, validação com `curl` e ponto de controle.
