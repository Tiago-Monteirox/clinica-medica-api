# Clínica Médica — Sistema de Microsserviços

[![CI](https://github.com/Tiago-Monteirox/clinica-medica-api/actions/workflows/ci.yml/badge.svg)](https://github.com/Tiago-Monteirox/clinica-medica-api/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/Tiago-Monteirox/clinica-medica-api/branch/main/graph/badge.svg)](https://codecov.io/gh/Tiago-Monteirox/clinica-medica-api)
![Java](https://img.shields.io/badge/Java-21-orange?logo=openjdk)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.3.5-6DB33F?logo=springboot)
![Docker Compose](https://img.shields.io/badge/Docker%20Compose-ready-2496ED?logo=docker)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Sistema de gestão de clínica médica construído com arquitetura de microsserviços. Java 21, Spring Boot 3.3, MySQL 8, comunicação via OpenFeign, autenticação JWT, deploy com Docker Compose e pipeline em GitHub Actions.

> Projeto integrador da disciplina. Esta é a base oficial — substitui versões anteriores no Desktop.

---

## Arquitetura

```
cliente / frontend / curl
        |
        v
gateway :8084 no host / :8080 no container
        |
        +--> administrativo :8081
        +--> agendamento    :8082
        +--> atendimento    :8083
                 |
                 v
            MySQL único em homologation
            ├─ clinica_administrativo
            ├─ clinica_agendamento
            └─ clinica_atendimento
```

Cada microsserviço tem **seu próprio schema lógico** em homologation. Em production, a mesma codebase aponta para **três bancos externos independentes**. A comunicação entre serviços é feita exclusivamente via HTTP/REST com **OpenFeign** declarativo. O Gateway é a única porta de entrada e centraliza autenticação JWT.

---

## Módulos

| Módulo | Porta | Responsabilidade |
|---|---|---|
| `commons` | — | Biblioteca técnica compartilhada: `ApiResponse<T>`, `GlobalExceptionHandler`, exceções base, DTOs de contrato, auto-configuration |
| `administrativo` | **8081** | CRUD de Convênio, Paciente e Médico. Fonte de verdade para validações vindas dos outros serviços |
| `agendamento` | **8082** | CRUD de Agendamento. Valida paciente/médico via Feign no `administrativo` |
| `atendimento` | **8083** | CRUD de Atendimento. Registra diagnóstico/prescrição. Valida agendamento via Feign |
| `gateway` | **8080** interno / **8084** em homologation | Roteamento + filtro JWT. Spring Cloud Gateway |

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

### Opção A — Homologation com Docker Compose (recomendado)

Sobe 1 MySQL local com 3 schemas, os 3 microsserviços e o gateway. É o ambiente usado para demonstração, teste manual e smoke test.

```bash
# 1. Criar o arquivo de ambiente local
cp .env.homologation.example .env.homologation

# 2. Gerar os JARs usados pelo Dockerfile runtime-only
mvn clean package -DskipTests

# 3. Subir a stack de homologation
docker compose \
  --env-file .env.homologation \
  -f docker-compose.yml \
  -f docker-compose.homologation.yml \
  up --build -d
```

Endpoints disponíveis após o boot:

- API Gateway: `http://localhost:8084`
- Swagger administrativo: `http://localhost:8081/swagger-ui.html`
- Swagger agendamento: `http://localhost:8082/swagger-ui.html`
- Swagger atendimento: `http://localhost:8083/swagger-ui.html`

```bash
# Smoke test de homologation
./scripts/smoke-homologation.sh

# Derrubar tudo (mantém volumes)
docker compose \
  --env-file .env.homologation \
  -f docker-compose.yml \
  -f docker-compose.homologation.yml \
  down

# Derrubar e apagar dados dos bancos
docker compose \
  --env-file .env.homologation \
  -f docker-compose.yml \
  -f docker-compose.homologation.yml \
  down -v
```

### Opção B — Production conceitual

Production não sobe MySQL local. Os serviços recebem URLs JDBC, usuários e senhas de bancos externos por variável de ambiente.

```bash
cp .env.production.example .env.production

docker compose \
  --env-file .env.production \
  -f docker-compose.yml \
  -f docker-compose.production.yml \
  up --build -d
```

O arquivo `.env.production` real não deve ser commitado. Use secrets/secret manager para `JWT_SECRET` e senhas de banco.

### Opção C — Local (IDE / terminal)

Pré-requisito: MySQL de homologation rodando na porta `3307`.

```bash
# 1. Subir só o banco de homologation
docker compose \
  --env-file .env.homologation \
  -f docker-compose.yml \
  -f docker-compose.homologation.yml \
  up -d mysql

# 2. Instalar commons no repositório local Maven
mvn clean install -pl commons

# 3. Em terminais separados:
mvn spring-boot:run -pl administrativo
mvn spring-boot:run -pl agendamento
mvn spring-boot:run -pl atendimento
mvn spring-boot:run -pl gateway
```

---

## Ambientes e CI/CD

### Docker por ambiente

| Ambiente | Comando base | Banco |
|---|---|---|
| `homologation` | `docker-compose.yml` + `docker-compose.homologation.yml` | 1 MySQL local com 3 schemas |
| `production` | `docker-compose.yml` + `docker-compose.production.yml` | 3 bancos externos/DBaaS |

Arquivos reais `.env*` ficam fora do Git. Apenas `.env.example`, `.env.homologation.example` e `.env.production.example` são versionados.

### GitHub Actions

O workflow principal fica em `.github/workflows/ci.yml`:

| Job | Quando roda | Função |
|---|---|---|
| `test` | push e pull request | executa `mvn -B test` |
| `build` | depois de `test` | gera os JARs e publica o artefato `jars` |
| `docker` | push em `main` | publica 4 imagens no GHCR com tags `${sha}` e `latest` |
| `smoke` | depois de `docker` em `main` | sobe a stack e roda `scripts/ci-smoke-test.sh` |

Imagens publicadas:

- `ghcr.io/tiago-monteirox/clinica-administrativo`
- `ghcr.io/tiago-monteirox/clinica-agendamento`
- `ghcr.io/tiago-monteirox/clinica-atendimento`
- `ghcr.io/tiago-monteirox/clinica-gateway`

O `GITHUB_TOKEN` é injetado automaticamente pelo GitHub Actions. Tokens pessoais, `JWT_SECRET` real e senhas de banco nunca devem ser colocados no YAML nem nos arquivos versionados.

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
| 18 | [Logging com SLF4J](docs/18-LOGGING.md) | Padronização com `@Slf4j` (Lombok), níveis de log, mapeamento por serviço |
| — | [**CHECKPOINT**](docs/CHECKPOINT.md) | **Estado atual: PASSOS 0–14 concluídos. Validações executadas. Pendências.** |

Diagramas PlantUML em [`docs/diagramas/`](docs/diagramas/).

---

## Estado atual do código

### Progresso

| Escopo | Status |
|---|---|
| PASSOS 0–14 | Concluídos: microsserviços, segurança, gateway, Docker, testes e conteinerização por ambiente |
| PASSO 15 | CI/CD com GitHub Actions implementado para `test`, `build`, `docker`, badge no README, smoke test e política de secrets |
| JaCoCo/Codecov | Opcional, ainda não configurado no workflow atual |

### O que já está implementado

**Infraestrutura**
- `Dockerfile` runtime-only parametrizado por `ARG MODULE`
- `docker-compose.yml` como base comum dos 4 serviços
- `docker-compose.homologation.yml` com MySQL 8.3 local, volume e healthcheck
- `docker-compose.production.yml` sem MySQL local, preparado para bancos externos
- `.env.example`, `.env.homologation.example`, `.env.production.example`
- `.gitignore` bloqueando `.env*` reais e liberando apenas exemplos
- `scripts/smoke-homologation.sh`, `scripts/smoke-production.sh` e `scripts/ci-smoke-test.sh`
- `sql/init.sql` cria os 3 schemas e as tabelas sem inserir senha hardcoded

**`pom.xml` raiz**
- Java 21, Spring Boot 3.3.5, versões centralizadas: JJWT 0.12.6, SpringDoc 2.6.0, Logbook 3.9.0, Testcontainers 1.20.4
- Spring Cloud BOM para OpenFeign e Gateway
- `maven-surefire-plugin` 3.3.1 (suporte a JUnit 5)
- `spring-boot-maven-plugin` com `repackage` para gerar JAR executável dos serviços

**Módulos**
- `commons`: `ApiResponse<T>`, exceções base, `GlobalExceptionHandler`, auto-configuration
- `administrativo`: Convênio, Médico, Paciente, Auth/JWT, seed admin e regras de autorização
- `agendamento`: CRUD de agendamentos, validação via Feign no `administrativo`
- `atendimento`: CRUD de atendimentos, validação via Feign no `agendamento`
- `gateway`: rotas públicas/privadas, filtro JWT e entrada única da API

**CI/CD**
- `.github/workflows/ci.yml` roda testes em push/PR
- publica JARs como artefato `jars`
- publica imagens Docker no GHCR em push para `main`
- executa smoke test após o publish das imagens
- README expõe o badge do workflow no topo

---

## Smoke test manual

Depois de subir homologation:

```bash
./scripts/smoke-homologation.sh
```

O script valida:

- health do Gateway;
- login com `admin@clinica.com`;
- endpoint privado com Bearer token;
- escrita mínima em convênios;
- `401` em endpoint privado sem token.

Para production, informe credenciais reais por variável de ambiente:

```bash
BASE_URL=https://api.exemplo.com \
ADMIN_EMAIL=admin@clinica.com \
ADMIN_PASSWORD=******** \
  ./scripts/smoke-production.sh
```

---

## Segurança

- Não commitar `.env`, `.env.homologation`, `.env.production`, tokens pessoais ou senhas reais.
- Usar `.env*.example` apenas como template didático.
- Em GitHub Actions, usar `${{ secrets.X }}` para secrets criados no repositório.
- O `GITHUB_TOKEN` já é injetado automaticamente pelo GitHub e é usado apenas para publicar/ler pacotes no GHCR.
- Em production real, guardar `JWT_SECRET` e senhas de banco em secret manager ou GitHub Secrets.
