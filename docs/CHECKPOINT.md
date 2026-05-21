# Checkpoint — clínica-médica-api

> Última atualização: 2026-05-21. Snapshot do progresso após concluir do **PASSO 0 ao 14** do `02-ROTEIRO.md` e redefinir o **PASSO 15** para conteinerização por ambiente + CI/CD com GitHub Actions. Inclui as decisões técnicas tomadas, desvios em relação ao roteiro original, validações executadas (inclusive Swagger) e o estado atual da stack.

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
| 15 | Conteinerização por ambiente + CI/CD com GitHub Actions | PENDENTE |

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

## Decisão atual de ambientes e CI/CD

Após discussão com o squad, a implementação de Kubernetes foi retirada da entrega atual. A decisão prática agora é:

| Tema | Decisão |
|---|---|
| Ambientes | Docker Compose com `homologation` e `production` |
| `homologation` | ambiente atual: 1 MySQL com 3 databases lógicos |
| `production` | containers da aplicação apontando para 3 bancos externos/DBaaS |
| CI/CD | GitHub Actions (cloud) com publicação de imagens no GHCR |
| Demonstração | push no GitHub → workflow → `mvn test` → build dos JARs → build/push das 4 imagens Docker no `ghcr.io/tiago-monteirox/clinica-*` → (opcional) smoke test |
| Frontend | adiado para depois |

Documentos criados/atualizados para essa decisão:

- [`14-CONTEINERIZACAO-AMBIENTES.md`](14-CONTEINERIZACAO-AMBIENTES.md) — guia de Docker Compose por ambiente.
- [`15-CICD-GITHUB-ACTIONS.md`](15-CICD-GITHUB-ACTIONS.md) — guia de CI/CD com GitHub Actions e GHCR.
- [`13-AMBIENTES-E-WIREFRAMES.md`](13-AMBIENTES-E-WIREFRAMES.md) — marcado como frontend adiado e proposta Kubernetes substituída.

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

**Pendência conhecida:** adicionar `@SecurityScheme` global em cada serviço para habilitar o botão **Authorize** do Swagger UI. Faz parte do polimento do PASSO 15 (ver lista abaixo).

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

## O que ficou pendente (PASSO 15)

- Separar Docker Compose em base + overrides:
  - `docker-compose.yml`
  - `docker-compose.homologation.yml`
  - `docker-compose.production.yml`
- Criar exemplos de ambiente:
  - `.env.homologation.example`
  - `.env.production.example`
- Criar smoke tests:
  - `scripts/smoke-homologation.sh`
  - `scripts/smoke-production.sh`
- Criar workflows em `.github/workflows/`:
  - `ci.yml` — `mvn test` + build dos JARs + build/push das 4 imagens Docker no GHCR (matrix por módulo)
  - `pr.yml` — apenas `mvn test` + build em pull requests (sem publicar imagem)
- Habilitar **Read and write permissions** em `Settings → Actions → General → Workflow permissions` (necessário pro GHCR).
- Adicionar plugin JaCoCo no `pom.xml` raiz e gerar relatório de cobertura no workflow.
- Adicionar badges no `README.md`:
  - status do workflow CI
  - cobertura (Codecov ou Coveralls)
- Tornar os pacotes do GHCR públicos (`Packages → Package settings → Change visibility`) para a banca conseguir puxar sem login.
- Revisar Swagger em todos os serviços (`@Tag`, `@Operation`, `@Schema`) como polimento.
- Adicionar `@SecurityScheme(name = "bearer-jwt", type = HTTP, scheme = "bearer", bearerFormat = "JWT")` em cada serviço para habilitar o botão **Authorize** do Swagger UI (hoje o usuário precisa colar o header `Authorization: Bearer <token>` manualmente em cada `Try it out`).

Esses são automação e polimento — não bloqueiam o **Definition of Done** funcional. O critério de CI/CD agora é demonstrar o pipeline rodando no **GitHub Actions** com `mvn test` verde, JARs como artefato e as 4 imagens publicadas no GHCR.

---

## Critérios do Definition of Done

| # | Critério | Estado |
|---|---|---|
| 1 | `docker compose up --build` sobe todos os containers sem erros | ATENDIDO |
| 2 | `POST /auth/login` via gateway retorna JWT válido | ATENDIDO |
| 3 | Fluxo convênio → médico → paciente → agendamento → atendimento via gateway | ATENDIDO |
| 4 | Sem token → 401, role errada → 403 | ATENDIDO |
| 5 | `mvn test` passa em todos os módulos | ATENDIDO |
| 6 | CI/CD com GitHub Actions rodando testes, build dos JARs e publicação de imagens Docker no GHCR | PENDENTE (PASSO 15) |
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

docs/13-AMBIENTES-E-WIREFRAMES.md             # frontend adiado; Kubernetes substituído
docs/14-CONTEINERIZACAO-AMBIENTES.md          # novo guia Docker Compose por ambiente
docs/15-CICD-GITHUB-ACTIONS.md                # novo guia GitHub Actions + GHCR
```

---

## Próximo passo

Implementar o **PASSO 15** pela nova estratégia documentada:

1. Seguir [`14-CONTEINERIZACAO-AMBIENTES.md`](14-CONTEINERIZACAO-AMBIENTES.md) para separar `homologation` e `production` com Docker Compose.
2. Seguir [`15-CICD-GITHUB-ACTIONS.md`](15-CICD-GITHUB-ACTIONS.md) para criar `.github/workflows/ci.yml` e publicar as 4 imagens no GHCR.
