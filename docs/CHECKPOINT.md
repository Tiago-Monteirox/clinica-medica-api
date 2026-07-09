# Checkpoint — clínica-médica-api

> Última atualização: 2026-07-09. Snapshot consolidado do estado atual após concluir os **PASSOS 0–22** (Redis + RabbitMQ), atualizar a base para Spring Boot 4.1 / Spring AI 2.0 e validar a suíte local com `mvn clean test` (**89 testes verdes**). Mantém abaixo alguns trechos históricos do roteiro original, mas o status vigente está nesta seção inicial.

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
| 7 | Spring Security + `@PreAuthorize` nos controllers | OK |
| 8 | Checkpoint administrativo ponta a ponta | OK |
| 9 | administrativo em container Docker | OK |
| 10 | agendamento (Feign + ErrorDecoder) | OK |
| 11 | atendimento (Feign + denormalização) | OK |
| 12 | API Gateway (Spring Cloud Gateway, WebFlux) | OK |
| 13 | Stack Docker completa | OK |
| 14 | Testes automatizados iniciais | OK |
| 15 | Conteinerização por ambiente + CI/CD com GitHub Actions | OK |
| 16 | Logging com SLF4J + Lombok | OK |
| 17 | Cobertura ampliada | OK |
| 20 | API Console estático para demonstração HOM/PROD | OK |
| 21 | Redis: cache no agendamento, rate limit no gateway, blacklist JWT | OK |
| 22 | RabbitMQ: AtendimentoRegistradoEvent, consumer idempotente, DLQ | OK |

---

## Arquitetura entregue

```text
cliente / api-console / curl
        |
        v
gateway :8084 HOM / :8085 PROD  ←→  Redis (rate limit + blacklist JWT)
        |
        +--> administrativo :8081
        +--> agendamento    :8082  ←→  Redis (cache paciente/médico)
        +--> atendimento    :8083
                 |
                 v (assíncrono, RabbitMQ)
            exchange clinica.events → agendamento → ATENDIDO

HOM:  1 MySQL + 1 Redis + 1 RabbitMQ (UI :15672)
PROD: 3 MySQLs + 1 Redis (vol persistente) + 1 RabbitMQ (UI :15673)
```

O gateway valida JWT e roteia. A autorização por role é aplicada nos microsserviços com `@PreAuthorize`. Entre serviços, a comunicação é HTTP/REST via OpenFeign.

---

## Decisão atual de ambientes e CI/CD

| Tema | Decisão |
|---|---|
| Ambientes | Docker Compose com `homologation` e `production` |
| `homologation` | 1 MySQL com 3 databases lógicos |
| `production` | 3 MySQLs dedicados em Compose local; em produção real, substituíveis por DBaaS |
| CI/CD | GitHub Actions com jobs `test`, `build`, `docker` e `smoke` |
| Demonstração | API Console estático com toggle HOM/PROD, Dozzle e smoke scripts |
| Frontend | API Console entregue; SPA de produto continua como evolução |

Documentos centrais:

- [`14-CONTEINERIZACAO-AMBIENTES.md`](14-CONTEINERIZACAO-AMBIENTES.md) — Docker Compose por ambiente.
- [`15-CICD-GITHUB-ACTIONS.md`](15-CICD-GITHUB-ACTIONS.md) — CI/CD com GitHub Actions e GHCR.
- [`17-AMBIENTES-TRADEOFFS.md`](17-AMBIENTES-TRADEOFFS.md) — defesa dos tradeoffs HOM x PROD.
- [`19-SANITY-CHECK.md`](19-SANITY-CHECK.md) — runbook pré-apresentação.
- [`20-API-CONSOLE.md`](20-API-CONSOLE.md) — API Console com switch HOM/PROD.

Kubernetes fica como evolução futura, não como entrega principal.

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

### 6. `PacienteController` evita mapping implícito de `convenioId`
O `PacienteRequest` tem `convenioId`, que é uma FK de entrada. Ao mapear o request direto para `PacienteEntity`, o ModelMapper pode interpretar o sufixo `Id` como o `id` da entidade e fazer o JPA tratar o paciente como detached, gerando 500 no cadastro. O controller agora monta a entidade explicitamente e passa o `convenioId` separado para o service.

### 7. Feign do `atendimento` repassa o JWT
O `atendimento` consome `GET /v1/agendamentos/{id}` do `agendamento`, que exige token. Foi adicionado um `RequestInterceptor` no `FeignConfig` do atendimento que extrai o `Authorization` da request atual via `RequestContextHolder` e propaga.

```java
@Bean
public RequestInterceptor authForwardingInterceptor() { ... }
```

### 8. `GlobalExceptionHandler` agora loga a exceção raiz
Antes, qualquer 500 vinha mudo. Adicionado `log.error("Erro não tratado", ex)` no handler genérico. Ajudou a diagnosticar o problema do `-parameters` e do ModelMapper.

### 9. Gateway na porta **8084** no host
A porta 8080 está em uso por um container `wordpress_app` na máquina. O `gateway` continua escutando 8080 dentro do container; o `docker-compose.yml` publica como `8084:8080`. Em um ambiente limpo, basta voltar para `8080:8080`.

### 10. Módulo `gateway` adicionado ao reactor
O parent pom original listava só `administrativo`, `atendimento`, `agendamento`, `commons`. `gateway` foi incluído. O `Dockerfile` também passou a copiar `gateway/pom.xml` e `gateway/src`.

### 11. Spring Cloud BOM no parent
Adicionado `spring-cloud-dependencies` no `dependencyManagement` para gerenciar OpenFeign (no agendamento e atendimento) e Gateway. A base atual usa Spring Cloud `2025.1.2`; no gateway, o starter compatível é `spring-cloud-starter-gateway-server-webflux`.

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
- Fluxo completo convênio → médico → paciente → agendamento → confirmação → atendimento via gateway funcionando, validado em 2026-07-09 na porta `8084`.

### Step 14/17 — testes automatizados
- `mvn clean test` executa **89 testes**, 0 falhas, 0 erros (validado em 2026-07-09):
  - `commons`: `GlobalExceptionHandlerTest` (7)
  - `administrativo`: `ConvenioServiceTest` (8), `MedicoServiceTest` (5), `PacienteServiceTest` (5), `PacienteControllerTest` (1), `AuthServiceTest` (6), `JwtServiceTest` (3)
  - `atendimento`: `AtendimentoControllerTest` (11), `AtendimentoServiceTest` (5), `AtendimentoEventPublisherTest` (1)
  - `agendamento`: `AgendamentoControllerTest` (9), `AgendamentoServiceTest` (6), `AdministrativoLookupServiceTest` (4), `AtendimentoRegistradoConsumerTest` (3)
  - `gateway`: `JwtAuthenticationFilterTest` (10), `JwtUtilTest` (5)

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

## Verificar rotas no Swagger UI

Cada microsserviço expõe seu próprio Swagger. O **gateway** não tem Swagger (é WebFlux puro, sem controllers REST próprios) — para inspecionar contratos, abra o Swagger do serviço de destino diretamente na sua porta.

### URLs

| Serviço | Swagger UI | OpenAPI JSON |
|---|---|---|
| `administrativo` | http://localhost:8081/swagger-ui.html | http://localhost:8081/v3/api-docs |
| `agendamento`    | http://localhost:8082/swagger-ui.html | http://localhost:8082/v3/api-docs |
| `atendimento`    | http://localhost:8083/swagger-ui.html | http://localhost:8083/v3/api-docs |

Todos os três retornam `302 → /swagger-ui/index.html` quando acessados pela URL canônica e `200` no JSON. Acesso ao Swagger UI e ao `/v3/api-docs` é **público** (configurado em cada `SecurityConfig` com `permitAll`).

### Passo a passo de validação

1. **Subir a stack e esperar ficar saudável**
   ```bash
   docker compose up --build -d
   docker compose ps              # 5 containers Up; mysql Healthy
   ```

2. **Abrir os três Swaggers no navegador** — confirmar que carregam sem 401/500:
   ```bash
   xdg-open http://localhost:8081/swagger-ui.html
   xdg-open http://localhost:8082/swagger-ui.html
   xdg-open http://localhost:8083/swagger-ui.html
   ```

3. **Conferir os `@Tag` por serviço** — devem aparecer exatamente esses grupos no menu lateral do Swagger UI:

   | Swagger | `@Tag`s esperados |
   |---|---|
   | `administrativo:8081` | `Autenticação`, `Convênios`, `Médicos`, `Pacientes` |
   | `agendamento:8082`    | `Agendamentos` |
   | `atendimento:8083`    | `Atendimentos` |

4. **Pegar um JWT válido** (qualquer um dos dois métodos):

   Pelo gateway (recomendado, mesmo fluxo do front):
   ```bash
   TOKEN=$(curl -s -X POST http://localhost:8084/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@clinica.com","senha":"admin123"}' | jq -r '.data.token')
   echo $TOKEN
   ```

   Direto no administrativo (sem passar pelo gateway):
   ```bash
   TOKEN=$(curl -s -X POST http://localhost:8081/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@clinica.com","senha":"admin123"}' | jq -r '.data.token')
   ```

5. **Autorizar no Swagger UI** — **AVISO IMPORTANTE:**
   O `OpenAPI` dos serviços ainda **não tem `SecurityScheme` HTTP Bearer configurado** (`@SecurityScheme(name = "bearer-jwt", type = HTTP, scheme = "bearer", bearerFormat = "JWT")`). Por isso, o botão **Authorize** não aparece no Swagger UI no estado atual.

   Enquanto o `SecurityScheme` não é adicionado (item do **PASSO 15**), use uma destas três opções para testar rotas protegidas:

   - **Opção A — Try it out + header manual:** clicar `Try it out` em qualquer endpoint, expandir os parâmetros, e adicionar manualmente o header `Authorization: Bearer <TOKEN>` na request. (Funciona endpoint a endpoint.)

   - **Opção B — Extensão do navegador:** ModHeader / Header Editor para injetar `Authorization: Bearer <TOKEN>` em todas as chamadas do Swagger UI automaticamente.

   - **Opção C — curl direto** (mais rápido para validar o contrato sem UI):
     ```bash
     curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8081/v1/convenios   | jq .
     curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8082/v1/agendamentos | jq .
     curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8083/v1/atendimentos | jq .
     ```

6. **Validar um endpoint protegido pelo Swagger (Opção A)**
   1. No Swagger do `administrativo`, expandir `Convênios → GET /v1/convenios`.
   2. Clicar `Try it out` → `Execute` **sem** token → resposta `401` (esperado).
   3. Repetir adicionando o header `Authorization: Bearer <TOKEN>` em `Parameters` → `Add string parameter` → header → resposta `200` com lista de convênios.

7. **Validar um endpoint público pelo Swagger** (não precisa de token)
   - `administrativo → Autenticação → POST /auth/login` com body `{"email":"admin@clinica.com","senha":"admin123"}` → `200` com `data.token`.
   - `administrativo → GET /v1/medicos/{id}/exists` → `200` (rota pública usada pelo Feign).

8. **Validar autorização por role**
   1. Logar como recepcionista (`recepcionista@clinica.com / recep123`, se seedado — caso contrário, criar via `/auth/register` autenticado como ADMIN).
   2. Tentar `POST /v1/convenios` → `403` (apenas ADMIN cria convênio — ver matriz de roles acima).
   3. Tentar `POST /v1/pacientes` → `201` (recepcionista pode).

### Critério de aceite do Swagger

- [ ] Os três Swaggers UI carregam (`/swagger-ui.html` → `302` → página renderiza).
- [ ] `/v3/api-docs` de cada serviço retorna `200` com JSON OpenAPI válido.
- [ ] Cada serviço lista seus `@Tag`s corretamente.
- [ ] Endpoint público (`/auth/login`, `/v1/*/exists`, `/actuator/health`) responde sem token.
- [ ] Endpoint protegido responde `401` sem token e `200` com `Authorization: Bearer <jwt>`.
- [ ] Endpoint com role insuficiente responde `403`.

**Polimento opcional:** adicionar `@SecurityScheme` global em cada serviço para habilitar o botão **Authorize** do Swagger UI. As rotas já funcionam com header manual ou chamada via API Console.

---

## Como rodar no Windows

A stack é portável (tudo em Docker + variáveis de ambiente). Esta seção lista as diferenças práticas em relação ao roteiro Linux/macOS.

### Pré-requisitos

| Item | Versão | Onde baixar |
|---|---|---|
| Docker Desktop + WSL2 backend | atual | https://www.docker.com/products/docker-desktop |
| JDK 21 (Temurin) | 21 | https://adoptium.net |
| Maven | 3.9+ | https://maven.apache.org/download.cgi (ou usar IntelliJ embedded) |
| Git for Windows | atual | https://git-scm.com/download/win |
| (Opcional) `jq` | atual | `choco install jq` ou `scoop install jq` |

### Setup inicial

```powershell
git clone git@github.com:Tiago-Monteirox/clinica-medica-api.git
cd clinica-medica-api

# O repositório tem .gitattributes com eol=lf, então o checkout já vem com
# line endings corretos para Dockerfile/init.sql/.sh/.yml.
git config --get core.autocrlf   # se retornar 'true', forçar:
git config core.autocrlf input
```

### Buildar e subir a stack

```powershell
# 1. Gerar os JARs (precisa de JDK 21 + Maven no PATH).
mvn clean package -DskipTests

# 2. Subir a stack (Docker Desktop deve estar rodando).
docker compose up --build -d

# 3. Conferir os 5 containers.
docker compose ps
```

### Smoke test em PowerShell (sem `jq`)

Equivalente PowerShell ao `curl + jq` dos exemplos Linux:

```powershell
# Login via gateway
$resp = Invoke-RestMethod -Uri http://localhost:8084/auth/login `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email":"admin@clinica.com","senha":"admin123"}'

$TOKEN = $resp.data.token
$headers = @{ Authorization = "Bearer $TOKEN" }

# Lista convênios
Invoke-RestMethod -Uri http://localhost:8084/api/admin/v1/convenios -Headers $headers

# Sem token → deve dar 401
try {
  Invoke-RestMethod -Uri http://localhost:8084/api/admin/v1/convenios
} catch {
  $_.Exception.Response.StatusCode.value__   # 401
}
```

Se preferir manter os comandos `curl + jq` da seção anterior, é só rodar pelo **WSL2** (`wsl --install`) ou pelo **Git Bash** que vem com o Git for Windows — ambos têm `curl` e `jq` (Git Bash precisa instalar `jq` separado).

### Pontos de atenção

| Ponto | Detalhe |
|---|---|
| **Porta 8084** | A escolha de `8084:8080` no `docker-compose.yml` foi por conta de um WordPress local no PC original. Em outras máquinas a 8080 está livre — pode editar para `8080:8080` ou deixar como está. |
| **Porta 3307** | MySQL exposto no host. Se houver outro MySQL local na máquina, trocar para `3308:3306` (ou qualquer livre). |
| **WSL2 backend** | Docker Desktop deve estar no modo WSL2 (padrão moderno). No backend Hyper-V antigo a stack ainda sobe, mas com bind mount mais lento. |
| **Line endings** | `.gitattributes` na raiz garante LF nos arquivos sensíveis (`Dockerfile`, `init.sql`, `*.sh`, `*.yml`). Se aparecer erro do tipo `^M: bad interpreter` ou MySQL falhar ao ler `init.sql`, rodar `git checkout-index --force --all` para reaplicar. |
| **`mvn clean package` é obrigatório antes do `docker compose up --build`** | O `Dockerfile` é runtime-only (só copia o JAR pronto). Esquecer esse passo gera erro `COPY failed: file not found`. |
| **Encerrar a stack** | `docker compose down` (mantém o volume do MySQL) ou `docker compose down -v` (apaga o banco). |

### Resumindo o fluxo completo no Windows

```powershell
git clone git@github.com:Tiago-Monteirox/clinica-medica-api.git
cd clinica-medica-api
mvn clean package -DskipTests
docker compose up --build -d
# abrir http://localhost:8084 (gateway)
# abrir http://localhost:8081/swagger-ui.html (Swagger administrativo)
```

---

## Status das antigas pendências do PASSO 15

As pendências listadas no checkpoint original foram concluídas ou reclassificadas:

- [x] Docker Compose separado em base + overlays: `docker-compose.yml`, `docker-compose.homologation.yml`, `docker-compose.production.yml`.
- [x] Exemplos de ambiente criados: `.env.homologation.example`, `.env.production.example`.
- [x] Smoke tests criados: `scripts/smoke-homologation.sh`, `scripts/smoke-production.sh`, `scripts/ci-smoke-test.sh`.
- [x] Workflow `.github/workflows/ci.yml` criado com jobs `test`, `build`, `docker` e `smoke`.
- [x] JaCoCo configurado no `pom.xml` raiz.
- [x] Badges principais adicionados ao README.
- [x] Swagger acessível publicamente nos três serviços.
- [ ] Polimento opcional: adicionar `@SecurityScheme` global para habilitar o botão **Authorize** do Swagger UI.
- [ ] Ação externa/manual: confirmar se os pacotes GHCR estão públicos para a banca, se houver necessidade de pull sem login.

Observação: não existe mais `.github/workflows/pr.yml`; o `ci.yml` já cobre `pull_request` para `main`.

---

## Critérios do Definition of Done

| # | Critério | Estado |
|---|---|---|
| 1 | `docker compose up --build` sobe todos os containers sem erros | ATENDIDO |
| 2 | `POST /auth/login` via gateway retorna JWT válido | ATENDIDO |
| 3 | Fluxo convênio → médico → paciente → agendamento → atendimento via gateway | ATENDIDO |
| 4 | Sem token → 401, role errada → 403 | ATENDIDO |
| 5 | `mvn test` passa em todos os módulos | ATENDIDO |
| 6 | CI/CD com GitHub Actions rodando testes, build dos JARs e publicação de imagens Docker no GHCR | ATENDIDO |
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

docs/13-AMBIENTES-E-WIREFRAMES.md             # SPA de produto proposta; API Console entregue no doc 20; Kubernetes substituído
docs/14-CONTEINERIZACAO-AMBIENTES.md          # novo guia Docker Compose por ambiente
docs/15-CICD-GITHUB-ACTIONS.md                # novo guia GitHub Actions + GHCR
```

---

## Material de apresentação

Documento de defesa para a banca, com tradeoffs entre homologation (1 banco lógico) e production (3 bancos físicos), as 6 regras de design que tornam a portabilidade real, comparação operacional ponto a ponto e FAQ com respostas curtas: [`17-AMBIENTES-TRADEOFFS.md`](17-AMBIENTES-TRADEOFFS.md).

---

## PASSO 14 — Conteinerização por ambiente (implementado em 2026-05-24)

Implementação dos overlays Docker Compose seguindo [`14-CONTEINERIZACAO-AMBIENTES.md`](14-CONTEINERIZACAO-AMBIENTES.md).

**Arquivos criados/alterados:**

```
docker-compose.yml                    # base neutra (sem mysql, sem ports, JDBC via env)
docker-compose.homologation.yml      # overlay: mysql local + portas 8081-8083/8084/3307
docker-compose.production.yml        # overlay: sem mysql, só gateway publicado
.env.homologation.example            # JDBC para mysql:3306 + admin seed default
.env.production.example              # placeholders SSL + user por serviço
scripts/smoke-homologation.sh        # 5 checks: health, login, GET, POST, 401
scripts/smoke-production.sh          # mesmos checks, parametrizado por env
.gitignore                            # passa a ignorar .env reais, preserva *.example
sql/init.sql                          # removido INSERT IGNORE de usuarios (seed = Java)
```

**Validação executada:**

- `docker compose ... config` valida sintaticamente os 2 overlays.
- Stack subiu via `docker compose --env-file .env.homologation -f docker-compose.yml -f docker-compose.homologation.yml up --build -d`.
- `./scripts/smoke-homologation.sh` passou 5/5 (Health UP, Login token, GET 200, POST 201, GET sem token 401).

**Bug corrigido durante a validação:**

O `sql/init.sql` continha um `INSERT IGNORE` em `usuarios` com hash BCrypt hardcoded que não batia com `admin123` (estava latente — só apareceu agora porque o `COMPOSE_PROJECT_NAME` mudou e gerou um volume Docker novo). O hash hardcoded foi removido; o `CommandLineRunner` em `AdministrativoApplication.seedAdmin` é fonte única do admin.

DoD do doc 14: itens 1-8 cumpridos.

---

## PASSO 14.2 — Production com 3 MySQLs reais (concluído em 2026-05-24)

Substitui os placeholders `db-*.internal` do `.env.production.example` por containers MySQL reais, implementando **database-per-service literal**.

**Arquivos criados/alterados:**

```
sql/init-administrativo.sql           # novo: DB + svc_administrativo + DDL
sql/init-agendamento.sql              # novo: DB + svc_agendamento + DDL
sql/init-atendimento.sql              # novo: DB + svc_atendimento + DDL
docker-compose.production.yml         # 3 containers MySQL: db-administrativo (3308),
                                      # db-agendamento (3309), db-atendimento (3310)
                                      # + volumes separados + healthchecks
.env.production.example               # senhas fixas didáticas + JWT gerado por openssl
                                      # + URLs JDBC com allowPublicKeyRetrieval=true
                                      # + GATEWAY_HOST_PORT=8085 (8080 ocupada)
docs/14-CONTEINERIZACAO-AMBIENTES.md  # tabela de containers, segredos por ambiente,
                                      # troubleshooting Public Key Retrieval
```

**Senhas didáticas (commitadas no `.env.production.example`):**

- `svc_administrativo` → `clinica_administrativo_prod_2026`
- `svc_agendamento` → `clinica_agendamento_prod_2026`
- `svc_atendimento` → `clinica_atendimento_prod_2026`
- `JWT_SECRET` gerado com `openssl rand -base64 64 | tr -d '\n'`

**Validação:**

- `docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml up --build -d` sobe 3 DBs healthy + 4 services UP
- `BASE_URL=http://localhost:8085 ADMIN_PASSWORD=admin123 ./scripts/smoke-production.sh` → 5/5 OK

**Bug corrigido durante validação:**

URLs JDBC sem `allowPublicKeyRetrieval=true` falham em MySQL 8 com `caching_sha2_password` quando o user tem senha e `useSSL=false`. Em hom não acontece porque root é vazio.

---

## PASSO 15 — CI/CD + JaCoCo + Codecov + LICENSE (concluído em 2026-05-24)

Pipeline completo no `.github/workflows/ci.yml` com 5 jobs em série (`test` → `build` → `docker` matrix → `smoke`) + integração Codecov.

**Arquivos criados/alterados:**

```
pom.xml                                # jacoco-maven-plugin 0.8.12 em <build><plugins>
                                       # com prepare-agent + report (phase=test)
.github/workflows/ci.yml               # job test agora inclui upload Codecov via
                                       # codecov/codecov-action@v4 (sem token; repo público)
.github/scripts/ci-smoke-test.sh       # wrapper criado pelo Codex
scripts/ci-smoke-test.sh               # smoke test que roda no job smoke do CI
LICENSE                                # MIT 2026 Tiago Monteiro
docs/15-CICD-GITHUB-ACTIONS.md         # PASSO C4 (JaCoCo) e C5 (badges) reescritos
                                       # com implementação real e snippets executáveis
README.md                              # 6 badges: CI, Codecov, Java 21, Spring Boot 4.1.0,
                                       # Docker Compose ready, MIT
```

**Cobertura inicial reportada (linhas):**

| Módulo | Cobertas / Total | % |
|---|---|---|
| `administrativo` | 38 / 244 | 15.6 |
| `agendamento` | 52 / 139 | 37.4 |
| `atendimento` | 41 / 132 | 31.1 |
| `commons`, `gateway` | sem testes | — |

**Bugs corrigidos no CI durante a implementação:**

1. `.env.homologation.example` / `docker-compose.homologation.yml` / `scripts/ci-smoke-test.sh` estavam untracked — adicionados na Fase 1 antes do CI passar.
2. `openssl rand -base64 64` gera saída multi-linha; `sed` falhava com `unterminated 's' command`. Fix: `| tr -d '\n'`.
3. `Wait for gateway` esperava só o gateway responder; admin ainda em bootstrap → login 500. Fix: probe que faz `POST /auth/login` com creds bobas e espera `401/422`.
4. `.github/workflows/pr.yml` era arquivo de 0 bytes que falhava em todo push — removido.

---

## PASSO 16 — Logging com SLF4J + Lombok (concluído em 2026-05-24)

Padronização do logging em todos os módulos com `@Slf4j` (Lombok), eliminando boilerplate de `LoggerFactory.getLogger(...)` e adicionando logging onde faltava.

**Classes refatoradas (boilerplate → `@Slf4j`):**

- `commons/GlobalExceptionHandler`
- `gateway/JwtAuthenticationFilter`
- `agendamento/AgendamentoService`
- `atendimento/AtendimentoService`

**Classes com `@Slf4j` + logs adicionados:**

- `administrativo/AdministrativoApplication.seedAdmin`
- `administrativo/auth/AuthService` (login + register)
- `administrativo/auth/JwtAuthFilter`
- `administrativo/convenio/ConvenioService`
- `administrativo/medico/MedicoService`
- `administrativo/paciente/PacienteService`

**Cobertura ampliada nas 4 classes que já logavam:**

- `AgendamentoService` — warns em conflito de horário, validação Feign falhando, tentativa de update em status terminal
- `AtendimentoService` — warns em duplicado, status inválido, agendamento ausente
- `GlobalExceptionHandler` — warns em handleFeignIntegration, handleAccessDenied, handleNoCredentials

**Configuração em cada `application.yml`:**

```yaml
logging:
  level:
    br.edu.imepac: ${LOG_LEVEL_APP:INFO}
```

Default: `INFO`. Override em homologation: `LOG_LEVEL_APP=DEBUG` no `.env.homologation`.

**Convenções (doc 18):**

- `info` em entry/exit de operações de negócio
- `warn` em cada validação que falha (login errado, conflito, duplicidade)
- `error` reservado para `handleGeneral` (exceção não tratada)
- `debug` para detalhes internos (filtro JWT rejeitando token)
- Placeholders `{}` do SLF4J sempre; mensagens em PT-BR
- Pattern do log: default do Spring Boot (sem MDC/JSON nesta etapa)

**Novo doc:** [`docs/18-LOGGING.md`](18-LOGGING.md).

**Validação:** `mvn test` passou; smoke production 5/5 OK; logs verificados (`INFO Tentativa de login para probe@p.com` → `WARN Login falhou: e-mail probe@p.com não cadastrado` → `INFO Login OK: usuário id=1`).

---

## PASSO 17 — Cobertura ampliada (concluído em 2026-05-24)

Subiu cobertura de testes em todos os 5 módulos, partindo do baseline `15/37/31/0/0%`. A suíte local atual tem **79 testes** verdes.

| Módulo | Antes | Depois | Δ | Testes adicionados |
|---|---|---|---|---|
| `commons` | 0% | **93.8%** | +93.8 | `GlobalExceptionHandlerTest` (7 testes) |
| `gateway` | 0% | **100.0%** | +100.0 | `JwtUtilTest` (5) + `JwtAuthenticationFilterTest` (10) |
| `administrativo` | 15.6% | **53.3%** | +37.7 | `AuthServiceTest` (5) + `JwtServiceTest` (3) |
| `agendamento` | 37.4% | **78.4%** | +41.0 | `AgendamentoControllerTest` (9) com `@WebMvcTest` |
| `atendimento` | 31.1% | **81.4%** | +50.3 | `AtendimentoControllerTest` (11) com `@WebMvcTest` |

**Decisão de arquitetura de testes:**

- Services: unit puro com Mockito (`@ExtendWith(MockitoExtension.class)`)
- Controllers: `@WebMvcTest` + `@MockBean` (sobe contexto Spring mockado, testa serialização + bean validation)
- Filter WebFlux do gateway: `MockServerWebExchange` + `MockServerHttpRequest`
- Handler de exceções: unit puro instanciando a classe e chamando os métodos

**Exclusions do JaCoCo (no `pom.xml`):**

Glue code do Spring sem lógica testável foi excluído do cálculo para que a métrica reflita só o código de negócio:

- `**/*Application.class`, `**/config/**`, `**/dto/**`, `**/entity/**`
- `**/*Request.class`, `**/*Response.class`, `**/*Entity.class`, `**/*Repository.class`
- `**/*SecurityConfig.class`, `**/*FeignConfig.class`, `**/client/**`
- `**/JwtAuthFilter.class` (servlet glue; NÃO o `JwtAuthenticationFilter` do gateway, que é WebFlux com lógica)

Detalhes técnicos completos no [`docs/15-CICD-GITHUB-ACTIONS.md`](15-CICD-GITHUB-ACTIONS.md), seção "Cobertura atual".

---

---

## PASSO 21 — Redis: cache, rate limit e blacklist JWT (concluído em 2026-06-10)

**Arquivos criados/alterados:**

```
agendamento/pom.xml                              # +starter-cache, +data-redis, +starter-amqp
agendamento/.../AgendamentoApplication.java      # +@EnableCaching
agendamento/.../client/AdministrativoLookupService.java  # novo: @Cacheable paciente-exists / medico-exists
agendamento/.../agendamento/AgendamentoService.java      # usa lookupService em vez de Feign direto
agendamento/src/main/resources/application.yml   # +spring.cache, spring.data.redis, clinica.events
agendamento/src/test/.../AdministrativoLookupServiceTest.java  # novo: 4 testes

gateway/pom.xml                                  # +data-redis-reactive
gateway/.../config/RateLimitConfig.java          # novo: userOrIpKeyResolver
gateway/.../security/JtiBlacklistService.java    # novo: revogar/estaRevogado via Redis reativo
gateway/.../auth/LogoutController.java           # novo: POST /auth/logout
gateway/.../security/JwtAuthenticationFilter.java  # +verificação blacklist opcional
gateway/src/main/resources/application.yml       # +rate limit nas rotas auth/agendamento, +redis config
gateway/src/test/.../JwtAuthenticationFilterTest.java  # construtor atualizado (blacklist=null)

administrativo/.../auth/JwtService.java          # +.id(UUID) — claim jti para blacklist
administrativo/src/test/.../JwtServiceTest.java  # +assertThat(claims.getId()).isNotBlank()

docker-compose.homologation.yml                  # +redis + rabbitmq com healthcheck
docker-compose.production.yml                    # +redis (persistente) + rabbitmq
.env.homologation.example                        # +REDIS_HOST_PORT, RABBITMQ_*
.env.production.example                          # +RABBITMQ_HOST_PORT, RABBITMQ_MANAGEMENT_HOST_PORT
```

**Definition of Done (doc 21):**
- [x] `docker compose` sobe Redis saudável em homologation e production.
- [x] `agendamento` usa Redis para cache de `pacienteExiste` e `medicoExiste`.
- [x] TTL configurável via `CACHE_TTL` (default 5m).
- [x] Gateway aplica rate limit e retorna `429` quando excedido.
- [x] Blacklist JWT: `POST /auth/logout` revoga o `jti`; requests subsequentes com o mesmo token retornam `401`.
- [x] Docs deixam claro que Redis é cache/infra, não fonte de verdade.

---

## PASSO 22 — RabbitMQ: AtendimentoRegistradoEvent (concluído em 2026-06-10)

**Arquivos criados/alterados:**

```
atendimento/pom.xml                              # +starter-amqp
atendimento/.../events/AtendimentoRegistradoEvent.java  # novo: contrato do evento
atendimento/.../messaging/RabbitEventsConfig.java       # novo: Jackson2JsonMessageConverter
atendimento/.../messaging/AtendimentoEventPublisher.java  # novo: publica evento após save
atendimento/.../atendimento/AtendimentoService.java     # +eventPublisher.publicarAtendimentoRegistrado(saved)
atendimento/src/main/resources/application.yml          # +spring.rabbitmq
atendimento/src/test/.../AtendimentoServiceTest.java    # +@Mock AtendimentoEventPublisher
atendimento/src/test/.../AtendimentoEventPublisherTest.java  # novo: 1 teste (capture + assert)

agendamento/pom.xml                              # +starter-amqp (já incluído no passo 21)
agendamento/.../events/AtendimentoRegistradoEvent.java  # novo: espelho do contrato
agendamento/.../messaging/RabbitEventsConfig.java       # novo: exchange + queue + DLQ + binding
agendamento/.../messaging/AtendimentoRegistradoConsumer.java  # novo: @RabbitListener idempotente
agendamento/.../agendamento/enums/StatusAgendamento.java  # +ATENDIDO
agendamento/src/test/.../AtendimentoRegistradoConsumerTest.java  # novo: 3 testes (consume/idempotência/DLQ)
```

**Definition of Done (doc 22):**
- [x] RabbitMQ sobe saudável no Docker Compose (hom e prod).
- [x] `atendimento` publica `AtendimentoRegistradoEvent` após registrar atendimento.
- [x] `agendamento` consome o evento e atualiza o status para `ATENDIDO`.
- [x] O consumidor é idempotente (status já `ATENDIDO` → descarta silenciosamente).
- [x] Falhas vão para retry (3x, back-off 2x) e depois DLQ (`agendamento.atendimento-registrado.dlq`).
- [x] RabbitMQ Management UI disponível em `:15672` (hom) / `:15673` (prod).
- [x] `mvn clean test` passa com 89 testes, 0 falhas.

---

## Próximo passo

Possíveis frentes futuras:

1. **MDC com `X-Request-Id`** para rastrear requisição entre serviços (doc 18, seção "Evoluções futuras").
2. **Sanity check completo pré-apresentação**: ver [`19-SANITY-CHECK.md`](19-SANITY-CHECK.md).
3. **Testes de integração com Testcontainers** (já tem a dependência) para subir MySQL/Redis/RabbitMQ real.
4. **Outbox pattern** para garantia de publicação transacional no `atendimento`.
