# Clínica Médica — Sistema de Microsserviços

Sistema de gestão de clínica médica construído com arquitetura de microsserviços. Java 17, Spring Boot 3.3, MySQL 8, comunicação via OpenFeign, autenticação JWT, deploy com Docker Compose e pipeline em GitHub Actions.

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
| Linguagem | Java | 17 |
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
| Java | 17 |
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
| 10 | [CI/CD com GitHub Actions](docs/10-CICD.md) | Pipeline de build, test e deploy |
| 11 | [Testes](docs/11-TESTES.md) | JUnit, Mockito, Testcontainers, MockMvc |
| 12 | [Referência de Tecnologias](docs/12-TECNOLOGIAS.md) | Aprofundamento técnico de cada peça |

Diagramas PlantUML em [`docs/diagramas/`](docs/diagramas/).

---

## Fluxo recomendado para o aluno

1. Ler [`docs/00-VISAO-GERAL.md`](docs/00-VISAO-GERAL.md) e [`docs/01-ARQUITETURA.md`](docs/01-ARQUITETURA.md) (≈30 min).
2. Seguir o [`docs/02-ROTEIRO.md`](docs/02-ROTEIRO.md) fase por fase, consultando o doc específico de cada módulo conforme aparece.
3. Usar [`docs/12-TECNOLOGIAS.md`](docs/12-TECNOLOGIAS.md) como referência sempre que aparecer uma dependência ou anotação que não conhece.

---

## Estado atual do código

### Já implementado

**Infraestrutura**
- `Dockerfile` multi-stage parametrizado (`ARG MODULE`) para todos os módulos
- `docker-compose.yml` com MySQL 8.3 (healthcheck), serviço `administrativo` e demais comentados até implementação
- `sql/init.sql` — cria as 3 bases e todas as tabelas com constraints e seed do usuário admin
- `.dockerignore`, `.env.example`

**`pom.xml` raiz**
- Java 17, Spring Boot 3.3.5, `dependencyManagement` centralizado para commons, MySQL, ModelMapper, JJWT 0.12.6, SpringDoc 2.6, Logbook 3.9, Testcontainers 1.20.4
- `maven-surefire-plugin` 3.x (JUnit 5)

**Módulo `commons`** *(biblioteca técnica pura — PASSO 1 concluído)*
- `ApiResponse<T>` — wrapper padrão para todas as respostas
- `BusinessException`, `EntityNotFoundException`, `FeignIntegrationException`
- `GlobalExceptionHandler` (`@RestControllerAdvice`) — mapeia exceções para HTTP com `ApiResponse`
- `CommonsAutoConfiguration` + SPI (`AutoConfiguration.imports`) — beans registrados automaticamente em qualquer módulo que declare `commons` como dependência

**Módulo `administrativo`** *(PASSO 2 concluído)*
- CRUD completo de Convênio com `ApiResponse<T>` (`ConvenioController`, `ConvenioEntity`, `ConvenioService`, `ConvenioRepository`)
- `application.yml` com variáveis de ambiente (`SERVER_PORT`, `SPRING_DATASOURCE_*`, `JWT_SECRET`, `JPA_SHOW_SQL`) e fallbacks para dev local
- Dependências prontas: Spring Security, JJWT, SpringDoc (Swagger), Logbook, Actuator, Testcontainers
- 8 testes unitários passando (`ConvenioServiceTest`)

**Módulos `agendamento` e `atendimento`** — classe `Application` apenas

### A ser feito

Ver [`docs/02-ROTEIRO.md`](docs/02-ROTEIRO.md) — próximo passo: **PASSO 3** (Médico) e **PASSO 4** (Paciente).
