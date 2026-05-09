# 02 — Roteiro de Implementação

> **Este é o documento principal para implementação manual.** Ele lista cada passo na ordem certa, com checklists e referências aos docs detalhados.

---

## Como usar este roteiro

- **Ordem importa.** Algumas fases dependem das anteriores (ex: Feign só funciona depois que `administrativo` expõe os endpoints).
- **Cada fase tem um checklist.** Marque (mentalmente ou em um TODO seu) cada item após completar.
- **Cada fase referencia o doc detalhado.** Quando precisar de código, consulte o doc específico do módulo.
- **Commits são seus.** O guia não pede commits específicos — você decide a granularidade.
- **Build sempre verde.** Após cada fase, rode `mvn clean install` na raiz e garanta que tudo compila.

---

## Visão geral das fases

| Fase | Tema | Tempo estimado |
|---|---|---|
| 0 | Diagnóstico do estado atual | 30 min |
| 1 | Refatoração do `commons` em biblioteca técnica | 2h |
| 2 | Domínio em `administrativo` (Convenio + Paciente + Médico) | 4h |
| 3 | Serviço `agendamento` + Feign | 3h |
| 4 | Serviço `atendimento` + Feign | 2h |
| 5 | API Gateway | 2h |
| 6 | Segurança (JWT) | 4h |
| 7 | Docker (multi-stage + compose com 3 MySQLs) | 2h |
| 8 | Testes (unit + integração com Testcontainers) | 4h |
| 9 | CI/CD com GitHub Actions | 2h |
| 10 | Polimento (Swagger, Logbook, README) | 2h |

**Total estimado:** ~28h. Implementação realista para um grupo de 2-3 pessoas em 2 semanas.

---

## Fase 0 — Diagnóstico do estado atual

Objetivo: ter clareza do que já existe e do que precisa mudar.

```bash
cd /home/tiagomonteiro/IdeaProjects/clinica-medica/clinica-medica

# Confirmar build atual
mvn clean install

# Confirmar que administrativo sobe
mvn spring-boot:run -pl administrativo
```

Acesse `http://localhost:8081/v1/convenios` e teste o CRUD existente com `curl` ou Postman.

**Checklist:**

- [ ] Repositório clonado e abrindo no IntelliJ
- [ ] `mvn clean install` passa
- [ ] `administrativo` sobe na porta 8081
- [ ] CRUD de Convênio testado (POST, GET, PUT, DELETE)
- [ ] Banco MySQL local rodando (via `docker compose up mysql`)

---

## Fase 1 — Refatorar o `commons` em biblioteca técnica

**Doc detalhado:** [`03-COMMONS.md`](03-COMMONS.md)

### 1.1 — Tirar `Convenio` do commons

A entidade `ConvenioEntity` + Repository + Service vão para o `administrativo`. O motivo: bounded contexts não compartilham entidades JPA. Compartilhar é compartilhar dor — qualquer mudança em Convenio força republicar o commons e recompilar todos.

```bash
# Mover (use git mv para preservar histórico)
git mv commons/src/main/java/br/edu/imepac/commons/entities/ConvenioEntity.java \
       administrativo/src/main/java/br/edu/imepac/administrativo/entities/

git mv commons/src/main/java/br/edu/imepac/commons/repositories/ConvenioRepository.java \
       administrativo/src/main/java/br/edu/imepac/administrativo/repositories/

git mv commons/src/main/java/br/edu/imepac/commons/services/ConvenioService.java \
       administrativo/src/main/java/br/edu/imepac/administrativo/services/

# Apagar o teste antigo do commons
rm commons/src/test/java/br/edu/imepac/commons/services/ConvenioServiceTest.java
```

Atualize todos os `package` e `import` para `br.edu.imepac.administrativo.*`. O IntelliJ faz isso automaticamente se você usar `Refactor → Move`.

### 1.2 — Criar a estrutura técnica do commons

Pacotes que o commons passa a ter:

```
br.edu.imepac.commons
├── config/         CommonsAutoConfiguration, ModelMapperConfig
├── dto/            PacienteDTO, MedicoDTO (contratos compartilhados entre serviços)
├── exception/      BusinessException, EntityNotFoundException, FeignIntegrationException
├── handler/        GlobalExceptionHandler
├── response/       ApiResponse<T>
└── util/           DateUtils
```

Detalhe de cada classe está em [`03-COMMONS.md`](03-COMMONS.md).

### 1.3 — Spring Auto-configuration via SPI

Crie `commons/src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` com:

```
br.edu.imepac.commons.config.CommonsAutoConfiguration
```

Isso faz o `GlobalExceptionHandler` e o `ModelMapper` serem registrados automaticamente em qualquer serviço que dependa do commons.

### 1.4 — Atualizar `commons/pom.xml`

Adicionar dependências necessárias para os utilitários (Spring Web para o handler, Validation, Jackson). Remover `spring-boot-starter-data-jpa` (sem entidades, não precisa mais). Detalhes em [`03-COMMONS.md`](03-COMMONS.md).

**Checklist:**

- [ ] `Convenio*` movidos para `administrativo`
- [ ] Pacotes `dto/`, `exception/`, `handler/`, `response/` criados em commons
- [ ] `ApiResponse<T>` implementado
- [ ] `GlobalExceptionHandler` implementado
- [ ] `BusinessException`, `EntityNotFoundException`, `FeignIntegrationException` criados
- [ ] `CommonsAutoConfiguration` criada
- [ ] `AutoConfiguration.imports` apontando para a auto-config
- [ ] `commons/pom.xml` ajustado (sem JPA)
- [ ] `mvn clean install -pl commons` passa

---

## Fase 2 — Domínio em `administrativo`

**Doc detalhado:** [`04-ADMINISTRATIVO.md`](04-ADMINISTRATIVO.md)

### 2.1 — Configurar `application.yml`

Migre de `application.properties` para `application.yml` (mais legível, melhor com perfis). Use variáveis de ambiente com defaults.

### 2.2 — Convênio (já existe — só ajustar)

- Ajustar `ConvenioController` para retornar `ApiResponse<T>` em vez de `ResponseEntity<T>` cru.
- Substituir `Optional.orElse(notFound)` por `throw new EntityNotFoundException(...)` (deixa o handler tratar).
- Adicionar anotações Swagger `@Tag`, `@Operation`.

### 2.3 — Paciente (novo)

Entidade `PacienteEntity` com:

- `id` Long auto
- `nome` String NotBlank
- `email` String unique NotBlank
- `cpf` String unique NotBlank (validar formato com `@Pattern`)
- `telefone` String
- `dataNascimento` LocalDate
- `convenio` ManyToOne FK opcional → `ConvenioEntity` (nullable)
- `createdAt`, `updatedAt` (auditoria via `@PrePersist`/`@PreUpdate`)

DTOs: `PacienteRequest` (criação), `PacienteUpdateRequest` (campos opcionais), `PacienteResponse` (com `ConvenioResponse` aninhado).

Endpoints:

```
POST   /v1/pacientes               (ADMIN, RECEPCIONISTA)
GET    /v1/pacientes               (ADMIN, RECEPCIONISTA)
GET    /v1/pacientes/{id}          (ADMIN, RECEPCIONISTA)
GET    /v1/pacientes/{id}/exists   (uso interno, sem auth)  ← Feign
PUT    /v1/pacientes/{id}          (ADMIN, RECEPCIONISTA)
DELETE /v1/pacientes/{id}          (ADMIN)
```

### 2.4 — Médico (novo)

Entidade `MedicoEntity` com:

- `id` Long
- `nome` String NotBlank
- `email` String unique NotBlank
- `crm` String unique NotBlank
- `especialidade` String NotBlank
- `telefone` String
- `createdAt`, `updatedAt`

Endpoints análogos a Paciente.

### 2.5 — Auth (login)

Endpoint público:

```
POST /auth/login   { email, senha } → { token, expiresIn }
```

Detalhes em [`08-SEGURANCA.md`](08-SEGURANCA.md). Por ora, registre como pendência.

**Checklist:**

- [ ] `application.yml` com env vars
- [ ] `ConvenioController` usando `ApiResponse<T>`
- [ ] `PacienteEntity` + DTOs + Repository + Service + Controller
- [ ] `MedicoEntity` + DTOs + Repository + Service + Controller
- [ ] Endpoints `/exists` para Paciente e Médico (Feign)
- [ ] Swagger acessível em `/swagger-ui.html`
- [ ] Banco `clinica_administrativo` com 3 tabelas (`convenios`, `pacientes`, `medicos`)

---

## Fase 3 — Serviço `agendamento` + Feign

**Doc detalhado:** [`05-AGENDAMENTO.md`](05-AGENDAMENTO.md)

### 3.1 — `agendamento/pom.xml`

Adicionar:

- `spring-boot-starter-web`
- `spring-boot-starter-data-jpa`
- `spring-boot-starter-validation`
- `spring-cloud-starter-openfeign`
- `mysql-connector-j`
- `commons` (do projeto)
- `springdoc-openapi-starter-webmvc-ui`
- `logbook-spring-boot-starter`

E no parent (`pom.xml` raiz), adicionar `dependencyManagement` para Spring Cloud BOM.

### 3.2 — Entidade `AgendamentoEntity`

```
- id Long
- pacienteId Long  (id lógico, sem FK)
- medicoId Long    (id lógico, sem FK)
- dataHora LocalDateTime
- status enum (AGENDADO, CONFIRMADO, CANCELADO, REALIZADO)
- observacoes String (até 500)
- createdAt, updatedAt
```

### 3.3 — `AdministrativoClient` (Feign)

Interface no pacote `client/`:

```java
@FeignClient(name = "administrativo", url = "${administrativo.url}")
public interface AdministrativoClient {
    @GetMapping("/v1/pacientes/{id}/exists")
    ExistsResponse pacienteExiste(@PathVariable Long id);

    @GetMapping("/v1/medicos/{id}/exists")
    ExistsResponse medicoExiste(@PathVariable Long id);
}
```

`ExistsResponse` é um record `{ boolean exists }` no commons.

### 3.4 — `FeignConfig` com `ErrorDecoder`

Traduz HTTP em exceções de domínio. Detalhes em [`05-AGENDAMENTO.md`](05-AGENDAMENTO.md).

### 3.5 — `AgendamentoService`

Antes de `save`, chama `client.pacienteExiste()` e `client.medicoExiste()`. Se qualquer um retornar `false` ou estourar, propaga.

Regras de negócio mínimas:

- `dataHora` não pode ser passada.
- Não pode haver outro agendamento `AGENDADO` ou `CONFIRMADO` para o mesmo médico no mesmo horário.

### 3.6 — Habilitar Feign no `AgendamentoApplication`

```java
@SpringBootApplication
@EnableFeignClients
public class AgendamentoApplication { ... }
```

**Checklist:**

- [ ] `agendamento/pom.xml` com todas as deps
- [ ] BOM Spring Cloud no parent
- [ ] `AgendamentoEntity` + DTOs + Repository
- [ ] `AdministrativoClient` (Feign)
- [ ] `FeignConfig` com `ErrorDecoder`
- [ ] `AgendamentoService` validando paciente/médico
- [ ] `AgendamentoController` com endpoints CRUD
- [ ] `@EnableFeignClients` ativo
- [ ] `application.yml` com `administrativo.url`
- [ ] Banco `clinica_agendamento` criado e populado por Hibernate
- [ ] Teste manual: criar agendamento com paciente válido (sucesso) e inválido (404)

---

## Fase 4 — Serviço `atendimento` + Feign

**Doc detalhado:** [`06-ATENDIMENTO.md`](06-ATENDIMENTO.md)

Mesma estrutura do agendamento. Cliente Feign chama `agendamento` para validar `agendamentoId`.

Entidade:

```
- id Long
- agendamentoId Long
- pacienteId Long       (denormalizado)
- medicoId Long         (denormalizado)
- dataAtendimento LocalDateTime
- diagnostico String (TEXT)
- prescricao String (TEXT)
- observacoes String (TEXT)
- createdAt, updatedAt
```

**Checklist:**

- [ ] `atendimento/pom.xml` com Feign + JPA + commons
- [ ] `AtendimentoEntity` + DTOs + Repository + Service + Controller
- [ ] `AgendamentoClient` (Feign) chamando agendamento
- [ ] Banco `clinica_atendimento`

---

## Fase 5 — API Gateway

**Doc detalhado:** [`07-GATEWAY.md`](07-GATEWAY.md)

### 5.1 — Criar módulo `gateway`

Adicionar `<module>gateway</module>` no `pom.xml` raiz e criar a pasta com o `pom.xml` do módulo (porta 8080, dependência `spring-cloud-starter-gateway`).

### 5.2 — `application.yml` com rotas

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: administrativo
          uri: ${ADMINISTRATIVO_URL:http://localhost:8081}
          predicates:
            - Path=/api/admin/**
          filters:
            - StripPrefix=2
        # idem para agendamento e atendimento
```

### 5.3 — Login

Roteie `/auth/login` para o `administrativo` (que tem o `AuthController`).

**Checklist:**

- [ ] Módulo `gateway` criado
- [ ] Rotas configuradas
- [ ] `mvn spring-boot:run -pl gateway` sobe na 8080
- [ ] `curl http://localhost:8080/api/admin/v1/convenios` chega no administrativo

---

## Fase 6 — Segurança (JWT)

**Doc detalhado:** [`08-SEGURANCA.md`](08-SEGURANCA.md)

### 6.1 — Tabela `usuarios` no `administrativo`

```
- id, nome, email (unique), senhaHash, role enum
```

`role` é `ADMIN | RECEPCIONISTA | MEDICO | PACIENTE`.

### 6.2 — `AuthService` (administrativo)

- `register(...)` — cria usuário com `BCryptPasswordEncoder`.
- `login(email, senha)` — valida hash e emite JWT com `iss`, `sub`, `roles`, `exp`.

### 6.3 — `JwtAuthenticationFilter` no Gateway

Filtro que:
1. Extrai `Authorization: Bearer <token>`.
2. Valida assinatura e expiração.
3. Coloca claims em `ServerWebExchange.attributes` para downstream.
4. Bloqueia rotas privadas com `401` se ausente/inválido.

### 6.4 — Filtro local em cada microsserviço

Defesa em profundidade: cada serviço também valida o token. Se o serviço for chamado direto (8081), exige token. Se vier do Gateway, idem (mesma chave HMAC).

### 6.5 — Autorização por role

Anotações `@PreAuthorize("hasRole('ADMIN')")` nos métodos do controller. Habilitar com `@EnableMethodSecurity`.

**Checklist:**

- [ ] Tabela `usuarios` + entidade + repository
- [ ] `AuthController` com `/auth/register` e `/auth/login`
- [ ] JWT emitido com chave HMAC compartilhada (env `JWT_SECRET`)
- [ ] Filtro JWT no Gateway
- [ ] Filtro JWT em cada microsserviço
- [ ] `@PreAuthorize` nos endpoints sensíveis
- [ ] Endpoints públicos: `/auth/**`, `/swagger-ui/**`, `/v3/api-docs/**`, `/v1/pacientes/{id}/exists` (uso interno entre serviços — pode ficar protegido por allow-list de IP em vez de JWT)

---

## Fase 7 — Docker

**Doc detalhado:** [`09-DOCKER.md`](09-DOCKER.md)

### 7.1 — `Dockerfile` multi-stage para cada serviço

```dockerfile
FROM eclipse-temurin:17-jdk AS build
WORKDIR /app
COPY .mvn .mvn
COPY mvnw pom.xml ./
COPY commons commons
COPY <serviço> <serviço>
RUN ./mvnw -pl <serviço> -am clean package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/<serviço>/target/*.jar app.jar
EXPOSE 808X
ENTRYPOINT ["java","-jar","/app/app.jar"]
```

### 7.2 — `docker-compose.yml` reescrito

3 MySQLs (`mysql-administrativo:3307`, `mysql-agendamento:3308`, `mysql-atendimento:3309`), 3 microsserviços, 1 gateway, healthchecks, `depends_on` com `condition: service_healthy`.

### 7.3 — Network `clinica-net`

Tudo na mesma network, comunicação interna por nome do container (`http://administrativo:8081`).

**Checklist:**

- [ ] `Dockerfile` em cada serviço (4 arquivos)
- [ ] `docker-compose.yml` com 3 MySQLs
- [ ] `docker compose up --build` sobe tudo verde
- [ ] Healthcheck dos MySQLs com `mysqladmin ping`
- [ ] Microsserviços só sobem após MySQL estar healthy

---

## Fase 8 — Testes

**Doc detalhado:** [`11-TESTES.md`](11-TESTES.md)

### Pirâmide

- **Unit (70%):** `service/` com Mockito (mock de repository e Feign client).
- **Integração (25%):** `controller/` com `@SpringBootTest`, `@AutoConfigureMockMvc`, Testcontainers MySQL.
- **End-to-end (5%):** Postman collection + script (manual ou via Newman).

### Cobertura mínima por serviço

- 1 teste de unidade por método público de Service.
- 1 teste de integração por endpoint REST (happy path + 1-2 caminhos de erro).
- Casos obrigatórios: 400 (validation), 404 (not found), 422 (business), 502 (Feign down).

**Checklist:**

- [ ] Cada `*Service` tem `*ServiceTest`
- [ ] Cada `*Controller` tem `*ControllerIT`
- [ ] Testcontainers MySQL configurado em `application-test.yml`
- [ ] `mvn test` passa em todos os módulos
- [ ] Cobertura ≥ 70% (medir com JaCoCo se possível)

---

## Fase 9 — CI/CD com GitHub Actions

**Doc detalhado:** [`10-CICD.md`](10-CICD.md)

### Workflows

1. **`ci.yml`** — em `push` e `pull_request`: `mvn clean verify`. Roda Testcontainers (precisa de Docker no runner — `ubuntu-latest` já tem).
2. **`docker.yml`** — em push para `main`: build das imagens e push para GHCR (GitHub Container Registry).
3. **`release.yml`** — opcional, em tag `v*`: cria Release com os JARs.

**Checklist:**

- [ ] `.github/workflows/ci.yml` rodando em PRs
- [ ] Cache de dependências Maven (`actions/setup-java@v4` com `cache: maven`)
- [ ] Status check obrigatório no `main`
- [ ] Badge no README

---

## Fase 10 — Polimento

- [ ] Swagger UI navegável em todos os serviços (anotações `@Tag`, `@Operation`, `@Schema`)
- [ ] Logbook configurado (`logging.level.org.zalando.logbook=TRACE`)
- [ ] README atualizado com prints / GIFs (opcional)
- [ ] Postman collection na raiz (igual ao `app-order-service`)
- [ ] Diagramas do `docs/diagramas/` atualizados

---

## Critérios de "Pronto" (Definition of Done)

O projeto está pronto quando:

1. `docker compose up --build` sobe a stack inteira sem erros.
2. Login retorna JWT válido.
3. Com o token, é possível: criar convênio → criar paciente → criar médico → criar agendamento → registrar atendimento.
4. Cada serviço tem Swagger funcionando.
5. `mvn test` passa em todos os módulos com Testcontainers ativo.
6. CI verde no GitHub Actions.
7. Documentação em `docs/` cobre todos os passos.

---

## Próximo passo

Comece a Fase 1 com [`03-COMMONS.md`](03-COMMONS.md).
