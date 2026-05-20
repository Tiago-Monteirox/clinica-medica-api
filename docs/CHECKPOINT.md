# Checkpoint — clínica-médica-api

> Última atualização: 2026-05-19. Snapshot do progresso após concluir do **PASSO 0 ao 14** do `02-ROTEIRO.md`. Inclui as decisões técnicas tomadas, desvios em relação ao roteiro original, validações executadas e o estado atual do stack.

---

## Resumo executivo

| Passo | Tema | Status |
|---|---|---|
| 0 | Diagnóstico inicial | OK |
| 1 | commons refatorado (auto-config) | OK |
| 2 | administrativo: pom + yml | OK |
| 3 | Convênio (entity + CRUD) | OK |
| 4 | Médico | OK |
| 5 | Paciente (FK opcional para Convênio) | OK |
| 6 | Auth + emissão JWT | OK |
| 7 | Spring Security + `@PreAuthorize` em **todos** os controllers | OK |
| 8 | Checkpoint administrativo ponta a ponta | OK |
| 9 | administrativo em container Docker | OK |
| 10 | agendamento (Feign + ErrorDecoder) | OK |
| 11 | atendimento (Feign + denormalização) | OK |
| 12 | API Gateway (Spring Cloud Gateway, WebFlux) | OK |
| 13 | Stack Docker completa (5 containers) | OK |
| 14 | Testes unitários (29 testes verdes) | OK |
| 15 | CI/CD e polimento | PENDENTE |

---

## Arquitetura entregue

```
 cliente
   │
   ▼
┌─────────────────────────────────────────────────┐
│  gateway  (Spring Cloud Gateway / WebFlux)      │
│  porta 8080 (host: 8084 — 8080 ocupado por      │
│  wordpress local)                               │
│                                                 │
│   /auth/**           → administrativo:8081      │
│   /api/admin/**      → administrativo:8081      │
│   /api/agendamentos/** → agendamento:8082       │
│   /api/atendimentos/** → atendimento:8083       │
└─────────────────────────────────────────────────┘
   │                │                  │
   ▼                ▼                  ▼
administrativo   agendamento        atendimento
  :8081            :8082               :8083
  + JWT           Feign→admin.        Feign→agend.
  + BCrypt        valida ID paciente   valida agendamento
  + 5 controllers e médico            denormaliza p/m IDs

       ▼              ▼                ▼
       └──── MySQL 8.3 (clinica-mysql:3306) ────┘
              ├─ clinica_administrativo
              ├─ clinica_agendamento
              └─ clinica_atendimento
```

---

## O que foi feito além do roteiro

Pontos onde o código real diverge ou amplia o que está documentado em `02-ROTEIRO.md`:

### 1. `@PreAuthorize` aplicado em **todos** os controllers
O roteiro só dá o exemplo explícito para `ConvenioController`. Aqui as regras foram aplicadas em todos os controllers seguindo a matriz de atores de `00-VISAO-GERAL.md`:

| Recurso | GET (list/byId) | POST/PUT | DELETE |
|---|---|---|---|
| `/v1/convenios`   | ADMIN, RECEPCIONISTA, MEDICO | ADMIN | ADMIN |
| `/v1/medicos`     | ADMIN, RECEPCIONISTA, MEDICO | ADMIN | ADMIN |
| `/v1/pacientes`   | ADMIN, RECEPCIONISTA, MEDICO | ADMIN, RECEPCIONISTA | ADMIN |
| `/v1/agendamentos` (POST/PUT) | — | ADMIN, RECEPCIONISTA | — |
| `/v1/agendamentos/{id}` (GET) | ADMIN, RECEPCIONISTA, MEDICO, PACIENTE | — | ADMIN, RECEPCIONISTA, PACIENTE |
| `/v1/atendimentos` (POST) | — | ADMIN, MEDICO | ADMIN |
| `/v1/atendimentos` (PUT) | — | MEDICO | — |
| `/auth/register`  | — | ADMIN | — |

`/v1/medicos/{id}/exists` e `/v1/pacientes/{id}/exists` ficam **públicos** no `SecurityFilterChain` (`permitAll`) — chamados pelo Feign do `agendamento`.

### 2. Erros 401/403 corretos
O default do Spring Security devolveria 403 sem token e 500 quando `@PreAuthorize` rejeita. Foram adicionados:
- `AuthenticationEntryPoint` em cada `SecurityConfig` → 401 sem/inválido token.
- `AccessDeniedHandler` no `SecurityConfig` + `@ExceptionHandler(AccessDeniedException.class)` no `GlobalExceptionHandler` do `commons` → 403 quando a role não bate.

`spring-security-core` foi adicionado como **dependência opcional** no `commons/pom.xml` para o handler enxergar a exceção sem forçar a dependência em quem não usa Security.

### 3. `-parameters` no maven-compiler-plugin
Sem ele, `@PathVariable Long id` sem nome explícito quebra com `IllegalArgumentException: Name for argument of type [java.lang.Long] not specified`. Adicionado no `<pluginManagement>` do `pom.xml` raiz.

Todos os controllers que estão sendo escritos a partir do agendamento usam a forma explícita `@PathVariable("id")` por defesa em profundidade — funciona com ou sem o flag.

### 4. `spring-boot-maven-plugin` com `repackage` no pluginManagement
O parent declarava o plugin sem `<executions>`, então o jar nunca era repackeado e o Docker subia com `no main manifest attribute`. Corrigido com:

```xml
<executions>
  <execution>
    <id>repackage</id>
    <goals><goal>repackage</goal></goals>
  </execution>
</executions>
```

O `commons` desabilita o repackage explicitamente (`<phase>none</phase>`) porque é biblioteca, não app.

### 5. ModelMapper substituído por builders no `AgendamentoService`
O `AgendamentoRequest` tem `pacienteId` e `medicoId`. O ModelMapper interpretava ambos como candidatos para `setId()` do `AgendamentoEntity` e lançava `ConfigurationException` no boot do mapping. Solução: o service constrói a entidade com `AgendamentoEntity.builder()` e converte com builder manual no `toResponse`. Sem dependência do ModelMapper nesse fluxo.

### 6. Feign do `atendimento` repassa o JWT
O `atendimento` consome `GET /v1/agendamentos/{id}` do `agendamento`, que exige token. Foi adicionado um `RequestInterceptor` no `FeignConfig` do atendimento que extrai o `Authorization` da request atual via `RequestContextHolder` e propaga.

```java
@Bean
public RequestInterceptor authForwardingInterceptor() { ... }
```

### 7. `GlobalExceptionHandler` agora loga a exceção raiz
Antes, qualquer 500 vinha mudo. Adicionado `log.error("Erro não tratado", ex)` no handler genérico. Ajudou a diagnosticar o problema do `-parameters` e do ModelMapper.

### 8. Gateway na porta **8084** no host
A porta 8080 está em uso por um container `wordpress_app` na máquina. O `gateway` continua escutando 8080 dentro do container; o `docker-compose.yml` publica como `8084:8080`. Em um ambiente limpo, basta voltar para `8080:8080`.

### 9. Módulo `gateway` adicionado ao reactor
O parent pom original listava só `administrativo`, `atendimento`, `agendamento`, `commons`. `gateway` foi incluído. O `Dockerfile` também passou a copiar `gateway/pom.xml` e `gateway/src`.

### 10. Spring Cloud BOM no parent
Adicionado `spring-cloud-dependencies` versão `2023.0.3` no `dependencyManagement` para gerenciar `spring-cloud-starter-openfeign` (no agendamento e atendimento) e `spring-cloud-starter-gateway` (no gateway).

---

## Validações executadas

Todas as checagens do roteiro foram rodadas e passaram (a saída é reproduzível com os scripts dos respectivos passos):

### Step 8 — administrativo ponta a ponta
- Login ADMIN → 200, token JWT.
- Sem token → 401. Token inválido → 401.
- `/v1/medicos/{id}/exists` e `/v1/pacientes/{id}/exists` públicos → 200.
- `/actuator/health` público → 200. Swagger UI público → 200.
- `/auth/register` sem token → 401. Recepcionista cria convênio → 403. Recepcionista cria paciente → 201. Recepcionista cria médico → 403.
- 4 tabelas em `clinica_administrativo` populadas.

### Step 10 — agendamento
- Criar com paciente/médico válidos → 201, status `AGENDADO`.
- Paciente inexistente → 404 (via `ErrorDecoder`). Médico inexistente → 404.
- Conflito de horário → 422. Data passada → 400 (`@Future`).
- Tabela `agendamentos` em `clinica_agendamento` criada.

### Step 11 — atendimento
- Registrar atendimento → 201. Duplicado → 422.
- Agendamento inexistente → 404 via Feign. Listar por paciente → 200.
- Coluna `agendamento_id UNIQUE` na tabela.

### Step 12 — gateway
- Login via `:8084/auth/login` (porta 8090 quando rodando local). Token retornado.
- `:8084/api/admin/v1/convenios` autenticado → 200. Sem token → 401.
- Roteamento para os 3 backends OK (`StripPrefix=2`).

### Step 13 — stack Docker
- `docker compose up --build -d` sobe 5 containers (`mysql`, `administrativo`, `agendamento`, `atendimento`, `gateway`).
- Fluxo completo convênio → médico → paciente → agendamento → atendimento via gateway funcionando.

### Step 14 — testes unitários
- `mvn test` executa **29 testes**, 0 falhas, 0 erros:
  - `ConvenioServiceTest` (8)
  - `MedicoServiceTest` (5)
  - `PacienteServiceTest` (5)
  - `AgendamentoServiceTest` (6)
  - `AtendimentoServiceTest` (5)

---

## Comandos de validação rápidos

```bash
# Stack
docker compose up --build -d
docker compose ps

# Login via gateway
TOKEN=$(curl -s -X POST http://localhost:8084/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clinica.com","senha":"admin123"}' | jq -r '.data.token')

# Fluxo ponta a ponta
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8084/api/admin/v1/convenios | jq .
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8084/api/agendamentos/v1/agendamentos | jq .
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8084/api/atendimentos/v1/atendimentos | jq .

# Tests
mvn test
```

---

## O que ficou pendente (PASSO 15)

- `.github/workflows/ci.yml` para CI no GitHub Actions.
- `.github/workflows/docker.yml` para publicação de imagens em GHCR.
- JaCoCo plugin no `pom.xml` para relatórios de cobertura.
- Badges no README.
- Revisão final dos `@Tag` / `@Operation` no Swagger.

Esses são automação e polimento — não bloqueiam o **Definition of Done** funcional. O critério "**CI verde no GitHub Actions**" (item 6 do DoD) só pode ser marcado depois do passo 15.

---

## Critérios do Definition of Done

| # | Critério | Estado |
|---|---|---|
| 1 | `docker compose up --build` sobe todos os containers sem erros | ATENDIDO |
| 2 | `POST /auth/login` via gateway retorna JWT válido | ATENDIDO |
| 3 | Fluxo convênio → médico → paciente → agendamento → atendimento via gateway | ATENDIDO |
| 4 | Sem token → 401, role errada → 403 | ATENDIDO |
| 5 | `mvn test` passa em todos os módulos | ATENDIDO |
| 6 | CI verde no GitHub Actions | PENDENTE (PASSO 15) |
| 7 | Swagger acessível em cada serviço sem autenticação | ATENDIDO |

---

## Inventário de arquivos novos / alterados

```
pom.xml                                         # +spring-cloud BOM, +parameters, +repackage execution, +gateway module
docker-compose.yml                              # 5 services (mysql, administrativo, agendamento, atendimento, gateway)
Dockerfile                                      # +gateway, jar pattern por módulo

commons/pom.xml                                 # +spring-security-core (optional), desliga repackage
commons/.../exceptions/handler/GlobalExceptionHandler.java   # +AccessDeniedException, +AuthCredentialsNotFound, +log

administrativo/.../config/SecurityConfig.java   # +AuthenticationEntryPoint, +AccessDeniedHandler
administrativo/.../convenio/ConvenioController.java  # +@PreAuthorize por método
administrativo/.../medico/MedicoController.java      # +@PreAuthorize
administrativo/.../paciente/PacienteController.java  # +@PreAuthorize
administrativo/.../auth/AuthController.java          # +@PreAuthorize em /register
administrativo/src/test/.../MedicoServiceTest.java   # novo
administrativo/src/test/.../PacienteServiceTest.java # novo

agendamento/pom.xml                             # reescrito com starter web/jpa/feign/security/jjwt
agendamento/src/main/resources/application.yml  # novo
agendamento/src/main/java/.../AgendamentoApplication.java   # +@EnableFeignClients
agendamento/src/main/java/.../agendamento/enums/StatusAgendamento.java   # novo
agendamento/src/main/java/.../agendamento/AgendamentoEntity.java         # novo
agendamento/src/main/java/.../agendamento/AgendamentoRepository.java     # novo
agendamento/src/main/java/.../agendamento/AgendamentoService.java        # novo
agendamento/src/main/java/.../agendamento/AgendamentoController.java     # novo
agendamento/src/main/java/.../agendamento/dto/{Request,UpdateRequest,Response}.java
agendamento/src/main/java/.../client/{AdministrativoClient,FeignConfig,ExistsResponse}.java
agendamento/src/main/java/.../security/{JwtAuthFilter,SecurityConfig}.java
agendamento/src/test/.../AgendamentoServiceTest.java   # novo

atendimento/pom.xml                             # idem agendamento
atendimento/src/main/resources/application.yml  # novo
atendimento/src/main/java/.../AtendimentoApplication.java                # +@EnableFeignClients
atendimento/src/main/java/.../atendimento/AtendimentoEntity.java         # agendamento_id UNIQUE
atendimento/src/main/java/.../atendimento/AtendimentoRepository.java
atendimento/src/main/java/.../atendimento/AtendimentoService.java
atendimento/src/main/java/.../atendimento/AtendimentoController.java
atendimento/src/main/java/.../atendimento/dto/{Request,UpdateRequest,Response}.java
atendimento/src/main/java/.../client/{AgendamentoClient,FeignConfig}.java   # FeignConfig propaga Authorization
atendimento/src/main/java/.../security/{JwtAuthFilter,SecurityConfig}.java
atendimento/src/test/.../AtendimentoServiceTest.java

gateway/pom.xml                                 # novo
gateway/src/main/resources/application.yml      # 4 rotas (auth, admin, agendamentos, atendimentos)
gateway/src/main/java/.../GatewayApplication.java
gateway/src/main/java/.../security/{JwtUtil,JwtAuthenticationFilter}.java
gateway/src/main/java/.../config/SecurityConfig.java   # permitAll no WebFlux; o filtro nosso é quem barra
```

---

## Próximo passo

Implementar o **PASSO 15** (`02-ROTEIRO.md` § PASSO 15): CI/CD e polimento.
