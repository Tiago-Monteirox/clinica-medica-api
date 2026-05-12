# 02 — Roteiro de Implementação

> **Guia de montagem do projeto.** Cada passo tem objetivo, implementação e validação.
> Não avance para o próximo passo sem passar na validação do atual.

---

## Mapa de dependências

Antes de escrever uma linha de código, entenda o grafo. A ordem do roteiro é ditada por ele.

```
commons  (biblioteca técnica — base de tudo)
    │
    └── administrativo
            ├── [PASSO 3] Convênio       — sem dependência de domínio
            ├── [PASSO 4] Médico         — sem dependência de domínio
            ├── [PASSO 5] Paciente       — FK opcional para Convênio
            ├── [PASSO 6] Auth/JWT       — depende das entidades acima
            └── [PASSO 7] Security       — depende de Auth
                    │
                    └── agendamento      — Feign para /exists (Paciente + Médico)
                                │
                                └── atendimento  — Feign para /agendamentos/{id}
                                            │
                                            └── gateway  — roteia para todos
```

**Leitura do grafo:**
- `commons` é o alicerce. Nada funciona sem ele estar correto.
- Dentro do `administrativo`, a ordem é: Convênio → Médico → Paciente → Auth → Security.
- `agendamento` só pode ser implementado depois que `/v1/pacientes/{id}/exists` e `/v1/medicos/{id}/exists` do `administrativo` estiverem no ar.
- `atendimento` só pode ser implementado depois que `/v1/agendamentos/{id}` do `agendamento` estiver no ar.
- `gateway` é sempre o último.

---

## Regra de ouro

**Não avance para o próximo passo sem que a validação do atual passe 100%.**

Se um passo não validar, o problema está nele — não no seguinte. Debugging em cima de código incompleto é a causa número 1 de tempo perdido. Cada passo deve ter um "verde" antes do próximo começar.

---

## Pré-requisitos

Antes de qualquer coisa, confirme:

```bash
java -version        # deve mostrar Java 17.x.x
mvn -version         # deve mostrar Maven 3.9.x
docker --version     # deve mostrar Docker 24+
docker compose version  # deve mostrar Compose 2.x
```

No IntelliJ: confirme que o SDK do projeto está configurado para Java 17 em `File → Project Structure → SDK`.

---

## PASSO 0 — Diagnóstico do estado inicial [30 min]

> Entender exatamente o que já existe antes de começar a mudar.

### O que fazer

**1. Compilar o projeto inteiro**

```bash
cd /home/tiagomonteiro/IdeaProjects/clinica-medica-api
mvn clean install -DskipTests
```

Deve compilar sem erros. Se falhar aqui, resolva antes de continuar.

**2. Subir o banco de dados**

```bash
docker compose up -d mysql
docker compose ps
# mysql deve estar "Up" com healthcheck "healthy"
```

**3. Subir o administrativo na IDE**

Execute `AdministrativoApplication.java` pelo IntelliJ. O console deve mostrar:

```
Tomcat started on port(s): 8081
Started AdministrativoApplication in X.XXX seconds
```

**4. Mapear o que já existe**

```bash
# Testar o CRUD de Convênio (já implementado no commons — ainda há migração a fazer)
curl -s http://localhost:8081/v1/convenios

# Criar um convênio de teste
curl -s -X POST http://localhost:8081/v1/convenios \
  -H "Content-Type: application/json" \
  -d '{"nome":"Unimed Teste","descricao":"Plano Básico"}'

# Listar novamente — deve aparecer o criado
curl -s http://localhost:8081/v1/convenios
```

**5. Entender o que precisa mudar**

| O que existe hoje | O que precisa mudar |
|---|---|
| `ConvenioEntity` está no `commons` | Mover para `administrativo` |
| `ConvenioController` retorna `ResponseEntity` cru | Retornar `ApiResponse<T>` |
| `commons` tem JPA, entidades, repositories | Vira biblioteca técnica pura |
| `agendamento` e `atendimento` têm apenas `@SpringBootApplication` | Implementar do zero |
| Sem Spring Security | Adicionar JWT em todos os serviços |
| Sem gateway | Criar módulo gateway |

### Ponto de controle — avance somente quando:

- [ ] `mvn clean install -DskipTests` passa na raiz
- [ ] `docker compose ps` mostra MySQL healthy
- [ ] `GET http://localhost:8081/v1/convenios` retorna HTTP 200
- [ ] `POST http://localhost:8081/v1/convenios` cria um convênio com sucesso

---

## PASSO 1 — Refatorar o `commons` em biblioteca técnica [2h]

> O `commons` deixa de ser uma biblioteca de domínio e vira um toolkit técnico puro.
> Nenhuma entidade JPA, nenhum conhecimento do domínio clínica.

**Doc detalhado:** [`03-COMMONS.md`](03-COMMONS.md)

**Depende de:** PASSO 0 concluído.

### Por que este é o primeiro passo

Todos os outros módulos vão importar o `commons`. Se ele tiver código de domínio (como `ConvenioEntity`), qualquer serviço que importar o commons carregaria código que não é dele. Além disso, o `GlobalExceptionHandler` e `ApiResponse<T>` precisam existir antes de qualquer controller ser ajustado.

### O que fazer

**1. Mover as classes de domínio para fora do commons**

Use o IntelliJ `Refactor → Move` para mover (preserva imports automaticamente):

```
commons/src/main/java/br/edu/imepac/commons/entities/ConvenioEntity.java
  → administrativo/src/main/java/br/edu/imepac/administrativo/convenio/ConvenioEntity.java

commons/src/main/java/br/edu/imepac/commons/repositories/ConvenioRepository.java
  → administrativo/src/main/java/br/edu/imepac/administrativo/convenio/ConvenioRepository.java

commons/src/main/java/br/edu/imepac/commons/services/ConvenioService.java
  → administrativo/src/main/java/br/edu/imepac/administrativo/convenio/ConvenioService.java
```

Remova o teste antigo:
```bash
rm commons/src/test/java/br/edu/imepac/commons/services/ConvenioServiceTest.java
```

**2. Criar a estrutura técnica do commons**

Crie os seguintes pacotes e classes (código completo em [`03-COMMONS.md`](03-COMMONS.md)):

```
commons/src/main/java/br/edu/imepac/commons/
├── config/
│   ├── CommonsAutoConfiguration.java
│   └── ModelMapperConfig.java             ← já existe, manter
├── dto/
│   ├── ExistsResponse.java                ← record { boolean exists }
│   ├── PacienteDTO.java
│   └── MedicoDTO.java
├── exception/
│   ├── BusinessException.java
│   ├── EntityNotFoundException.java
│   └── FeignIntegrationException.java
├── handler/
│   └── GlobalExceptionHandler.java
├── response/
│   └── ApiResponse.java                   ← genérico ApiResponse<T>
└── util/
    └── DateUtils.java
```

**3. Registrar a auto-configuration (SPI do Spring Boot 3.x)**

Crie o arquivo:
```
commons/src/main/resources/META-INF/spring/
    org.springframework.boot.autoconfigure.AutoConfiguration.imports
```

Conteúdo:
```
br.edu.imepac.commons.config.CommonsAutoConfiguration
```

Esse arquivo faz o `GlobalExceptionHandler` e o `ModelMapper` serem registrados automaticamente em qualquer serviço que dependa do commons — sem `@ComponentScan` explícito.

**4. Atualizar o `commons/pom.xml`**

Remover `spring-boot-starter-data-jpa` (não tem mais entidades).
Adicionar `spring-boot-starter-web` com `scope: provided` (necessário para compilar o `@RestControllerAdvice`).
Ver pom.xml completo em [`03-COMMONS.md`](03-COMMONS.md).

### Validação

```bash
# Compilar e instalar o commons no repositório local Maven
mvn clean install -pl commons -DskipTests

# Verificar que NÃO é um fat JAR (não deve ter BOOT-INF)
jar tf commons/target/commons-1.0-SNAPSHOT.jar | grep BOOT-INF
# → não deve retornar nada

# Verificar que tem o arquivo de auto-configuration
jar tf commons/target/commons-1.0-SNAPSHOT.jar | grep AutoConfiguration.imports
# → META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
```

### Ponto de controle — avance somente quando:

- [ ] `mvn clean install -pl commons -DskipTests` passa
- [ ] O JAR do commons NÃO contém `BOOT-INF/`
- [ ] O JAR do commons contém `AutoConfiguration.imports`
- [ ] `ApiResponse<T>`, `GlobalExceptionHandler`, `BusinessException`, `EntityNotFoundException`, `FeignIntegrationException` existem

---

## PASSO 2 — Preparar o módulo `administrativo` [30 min]

> Configurar o `pom.xml` e o `application.yml` antes de implementar qualquer funcionalidade.
> Fazer isso agora evita retrabalho nas próximas horas.

**Depende de:** PASSO 1 concluído (commons instalado no repositório local).

### O que fazer

**1. Atualizar o `pom.xml` raiz — adicionar Spring Cloud BOM**

No `pom.xml` da raiz, adicione ao `<dependencyManagement>`:

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-dependencies</artifactId>
    <version>2023.0.3</version>
    <type>pom</type>
    <scope>import</scope>
</dependency>
<dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>testcontainers-bom</artifactId>
    <version>1.20.4</version>
    <type>pom</type>
    <scope>import</scope>
</dependency>
```

E ao bloco `<properties>`:
```xml
<spring-cloud.version>2023.0.3</spring-cloud.version>
<testcontainers.version>1.20.4</testcontainers.version>
```

**2. Atualizar o `administrativo/pom.xml` — adicionar dependências**

Adicione ao `administrativo/pom.xml` (que já tem web, JPA, MySQL, commons, lombok, validation):

```xml
<!-- Swagger/OpenAPI -->
<dependency>
    <groupId>org.springdoc</groupId>
    <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
    <version>2.6.0</version>
</dependency>

<!-- Spring Security + JWT -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-security</artifactId>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-api</artifactId>
    <version>0.12.6</version>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-impl</artifactId>
    <version>0.12.6</version>
    <scope>runtime</scope>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-jackson</artifactId>
    <version>0.12.6</version>
    <scope>runtime</scope>
</dependency>

<!-- Actuator (healthcheck) -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>

<!-- Logbook (log de requisições HTTP) -->
<dependency>
    <groupId>org.zalando</groupId>
    <artifactId>logbook-spring-boot-starter</artifactId>
    <version>3.9.0</version>
</dependency>

<!-- Testcontainers -->
<dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>junit-jupiter</artifactId>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>mysql</artifactId>
    <scope>test</scope>
</dependency>
```

**3. Migrar `application.properties` → `application.yml`**

Renomeie o arquivo e substitua o conteúdo por:

```yaml
server:
  port: ${SERVER_PORT:8081}
  shutdown: graceful

spring:
  application:
    name: administrativo
  datasource:
    url: jdbc:mysql://${DB_HOST:localhost}:${DB_PORT:3307}/${DB_NAME:clinica_administrativo}?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=America/Sao_Paulo
    username: ${DB_USER:root}
    password: ${DB_PASSWORD:}
    driver-class-name: com.mysql.cj.jdbc.Driver
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: ${JPA_SHOW_SQL:false}
    properties:
      hibernate:
        format_sql: true
        dialect: org.hibernate.dialect.MySQLDialect

management:
  endpoints:
    web:
      exposure:
        include: health
  endpoint:
    health:
      show-details: never

springdoc:
  swagger-ui:
    path: /swagger-ui.html

logbook:
  format:
    style: http
  predicate:
    exclude:
      - path: /actuator/**
      - path: /swagger-ui/**
      - path: /v3/api-docs/**

logging:
  level:
    br.edu.imepac: DEBUG
    org.zalando.logbook: TRACE

jwt:
  secret: ${JWT_SECRET:dev-secret-please-change-in-production-com-256-bits-no-minimo}
  expiration: ${JWT_EXPIRATION:3600000}
```

**4. Atualizar `AdministrativoApplication`**

```java
@SpringBootApplication(scanBasePackages = "br.edu.imepac")
public class AdministrativoApplication {
    public static void main(String[] args) {
        SpringApplication.run(AdministrativoApplication.class, args);
    }
}
```

O `scanBasePackages = "br.edu.imepac"` é necessário para o Spring varrer tanto `br.edu.imepac.administrativo` quanto o que vier do `commons` via auto-configuration.

### Validação

```bash
# Compilar tudo (com os novos poms)
mvn clean install -DskipTests

# Subir o administrativo (o Spring Security vai bloquear tudo por padrão — normal por enquanto)
mvn spring-boot:run -pl administrativo
```

O console deve mostrar o Spring Security gerando uma senha temporária:
```
Using generated security password: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Isso é esperado — significa que o Spring Security está ativo. Vamos configurá-lo no PASSO 7.

### Ponto de controle — avance somente quando:

- [ ] `mvn clean install -DskipTests` passa na raiz
- [ ] `administrativo` sobe sem erros (mesmo que endpoints estejam bloqueados pelo Security)
- [ ] `application.yml` com as variáveis de ambiente configuradas
- [ ] Swagger UI acessível em `http://localhost:8081/swagger-ui.html` (pode pedir login — normal)

---

## PASSO 3 — Convênio no `administrativo` [1h]

> Migrar a entidade `ConvenioEntity` do `commons` para o `administrativo` e adaptar o controller
> para usar `ApiResponse<T>`. Primeira peça de domínio no lugar certo.

**Depende de:** PASSO 2 concluído.
**Doc detalhado:** [`04-ADMINISTRATIVO.md`](04-ADMINISTRATIVO.md) § Convênio.

### Por que Convênio vem primeiro

É a entidade mais simples: sem FK, sem regras de negócio complexas. Serve como template para Médico e Paciente. Parte dela já existe — é uma migração, não criação do zero.

### O que fazer

**1. Mover a entidade** (já iniciado no PASSO 1, ajustar packages se necessário)

Estrutura alvo:
```
administrativo/src/main/java/br/edu/imepac/administrativo/convenio/
├── ConvenioEntity.java
├── ConvenioRepository.java
├── ConvenioService.java
├── ConvenioController.java
└── dto/
    ├── ConvenioRequest.java
    └── ConvenioResponse.java
```

**2. Atualizar `ConvenioEntity`** — adicionar `createdAt`, `updatedAt` e `@PrePersist`/`@PreUpdate`:

```java
@Column(nullable = false, updatable = false)
private LocalDateTime createdAt;

@Column(nullable = false)
private LocalDateTime updatedAt;

@PrePersist
void onCreate() { createdAt = updatedAt = LocalDateTime.now(); }

@PreUpdate
void onUpdate() { updatedAt = LocalDateTime.now(); }
```

**3. Atualizar `ConvenioService`** — usar `EntityNotFoundException` do commons:

```java
public ConvenioResponse findById(Long id) {
    return repository.findById(id)
        .map(e -> modelMapper.map(e, ConvenioResponse.class))
        .orElseThrow(() -> new EntityNotFoundException("Convênio", id));
}
```

Verificar se `existsByNomeIgnoreCase` está no repository para validação de duplicata:
```java
boolean existsByNomeIgnoreCase(String nome);
```

**4. Reescrever `ConvenioController`** — wrapping em `ApiResponse<T>`:

```java
@GetMapping
public ResponseEntity<ApiResponse<List<ConvenioResponse>>> findAll() {
    return ResponseEntity.ok(ApiResponse.success(service.findAll()));
}

@PostMapping
public ResponseEntity<ApiResponse<ConvenioResponse>> create(@Valid @RequestBody ConvenioRequest req) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(ApiResponse.success("Convênio criado", service.create(req)));
}
```

Adicione `@Tag(name = "Convênio")` na classe e `@Operation(summary = "...")` nos métodos.

### Validação

Antes de adicionar o Security (PASSO 7), ainda conseguimos testar sem token. Suba o serviço e execute:

```bash
# Criar convênio
curl -s -X POST http://localhost:8081/v1/convenios \
  -H "Content-Type: application/json" \
  -d '{"nome":"Unimed","descricao":"Plano Premium"}' | jq .
```

Saída esperada:
```json
{
  "success": true,
  "message": "Convênio criado",
  "data": { "id": 1, "nome": "Unimed", "descricao": "Plano Premium", "createdAt": "...", "updatedAt": "..." }
}
```

```bash
# Listar
curl -s http://localhost:8081/v1/convenios | jq .

# Buscar por ID inválido — deve retornar 404 via GlobalExceptionHandler
curl -s http://localhost:8081/v1/convenios/999 | jq .
```

Saída esperada para o 404:
```json
{ "success": false, "message": "Convênio com id 999 não encontrado" }
```

```bash
# Criar com nome em branco — deve retornar 400
curl -s -X POST http://localhost:8081/v1/convenios \
  -H "Content-Type: application/json" \
  -d '{"descricao":"sem nome"}' | jq .
```

Saída esperada para o 400:
```json
{ "success": false, "message": "Dados inválidos", "errors": ["nome: não deve estar em branco"] }
```

**Verificar banco de dados:**
```bash
docker compose exec mysql mysql -uroot clinica_administrativo \
  -e "SELECT id, nome, created_at FROM convenios;"
```

### Ponto de controle — avance somente quando:

- [ ] `POST /v1/convenios` retorna `201 Created` com `ApiResponse.success`
- [ ] `GET /v1/convenios/{id}` com id inválido retorna `404` com mensagem do `GlobalExceptionHandler`
- [ ] `POST` com campo obrigatório vazio retorna `400` com lista de erros
- [ ] Tabela `convenios` existe no banco com colunas `created_at` e `updated_at`
- [ ] Swagger UI mostra os endpoints de Convênio

---

## PASSO 4 — Médico [45 min]

> Implementar o cadastro de Médico: entidade nova, sem FK de domínio,
> com o endpoint `/exists` que o `agendamento` vai consumir via Feign.

**Depende de:** PASSO 3 concluído.
**Doc detalhado:** [`04-ADMINISTRATIVO.md`](04-ADMINISTRATIVO.md) § Médico.

### Por que Médico vem antes de Paciente

Médico não tem FK para nada. Paciente tem FK opcional para Convênio. Implementar na ordem do mais simples ao mais complexo.

### O que fazer

**1. Criar a estrutura:**

```
administrativo/.../medico/
├── MedicoEntity.java
├── MedicoRepository.java
├── MedicoService.java
├── MedicoController.java
└── dto/
    ├── MedicoRequest.java
    ├── MedicoUpdateRequest.java
    └── MedicoResponse.java
```

**2. `MedicoEntity` — campos obrigatórios:**

```java
@Entity
@Table(name = "medicos",
       uniqueConstraints = {
           @UniqueConstraint(columnNames = "email"),
           @UniqueConstraint(columnNames = "crm")
       })
public class MedicoEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank @Size(max = 150)
    @Column(nullable = false, length = 150)
    private String nome;

    @NotBlank @Email
    @Column(nullable = false, length = 200)
    private String email;

    @NotBlank @Size(max = 20)
    @Column(nullable = false, length = 20)
    private String crm;

    @NotBlank @Size(max = 100)
    @Column(nullable = false, length = 100)
    private String especialidade;

    @Size(max = 20)
    @Column(length = 20)
    private String telefone;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist void onCreate() { createdAt = updatedAt = LocalDateTime.now(); }
    @PreUpdate  void onUpdate() { updatedAt = LocalDateTime.now(); }
}
```

**3. `MedicoRepository` — queries de unicidade:**

```java
boolean existsByEmail(String email);
boolean existsByCrm(String crm);
```

**4. `MedicoController` — incluir o endpoint `/exists`:**

```java
// Endpoint para consumo interno via Feign (agendamento → administrativo)
// Deve ser público (sem autenticação JWT) — configurado no SecurityConfig (PASSO 7)
@GetMapping("/{id}/exists")
public ExistsResponse exists(@PathVariable Long id) {
    return new ExistsResponse(service.exists(id));
}
```

### Validação

```bash
# Criar médico
curl -s -X POST http://localhost:8081/v1/medicos \
  -H "Content-Type: application/json" \
  -d '{"nome":"Dr. Paulo Silva","email":"paulo@clinica.com","crm":"CRM/MG 123456","especialidade":"Cardiologia","telefone":"31999990001"}' | jq .

# Verificar endpoint /exists (será chamado pelo agendamento via Feign)
curl -s http://localhost:8081/v1/medicos/1/exists | jq .
# → {"exists":true}

curl -s http://localhost:8081/v1/medicos/999/exists | jq .
# → {"exists":false}

# Tentar CRM duplicado — deve retornar 422
curl -s -X POST http://localhost:8081/v1/medicos \
  -H "Content-Type: application/json" \
  -d '{"nome":"Dr. Outro","email":"outro@clinica.com","crm":"CRM/MG 123456","especialidade":"Clínica Geral"}' | jq .
# → {"success":false,"message":"CRM já cadastrado"}
```

**Verificar banco:**
```bash
docker compose exec mysql mysql -uroot clinica_administrativo \
  -e "SHOW TABLES; DESCRIBE medicos;"
```

### Ponto de controle — avance somente quando:

- [ ] `POST /v1/medicos` cria médico com sucesso
- [ ] `GET /v1/medicos/{id}/exists` retorna `{"exists":true}` para ID válido e `{"exists":false}` para inválido
- [ ] Criar médico com CRM duplicado retorna 422 com mensagem de negócio
- [ ] Tabela `medicos` criada com `unique` em `email` e `crm`

---

## PASSO 5 — Paciente [1h30]

> Entidade mais complexa do `administrativo`: FK opcional para Convênio,
> endpoint `/exists` para o `agendamento` e validação de CPF.

**Depende de:** PASSO 4 concluído (a FK para Convênio precisa que a tabela `convenios` exista).
**Doc detalhado:** [`04-ADMINISTRATIVO.md`](04-ADMINISTRATIVO.md) § Paciente.

### O que fazer

**1. Criar a estrutura:**

```
administrativo/.../paciente/
├── PacienteEntity.java
├── PacienteRepository.java
├── PacienteService.java
├── PacienteController.java
└── dto/
    ├── PacienteRequest.java      ← todos campos, convenioId opcional
    ├── PacienteUpdateRequest.java ← campos opcionais para PATCH parcial
    └── PacienteResponse.java     ← inclui ConvenioResponse aninhado
```

**2. `PacienteEntity` — ponto crítico é a FK nullable:**

```java
// FK para Convênio: nullable — nem todo paciente tem plano
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "convenio_id")     // sem nullable=false
private ConvenioEntity convenio;
```

**3. `PacienteRequest` — o campo de convênio recebe o ID, não o objeto:**

```java
private Long convenioId;   // null se o paciente não tem convênio
```

**4. `PacienteService.create` — resolver o convênio antes de salvar:**

```java
public PacienteResponse create(PacienteRequest req) {
    if (repository.existsByEmail(req.getEmail()))
        throw new BusinessException("E-mail já cadastrado");
    if (repository.existsByCpf(req.getCpf()))
        throw new BusinessException("CPF já cadastrado");

    PacienteEntity entity = modelMapper.map(req, PacienteEntity.class);

    // Resolver FK: se convenioId foi informado, buscar a entidade
    if (req.getConvenioId() != null) {
        entity.setConvenio(convenioService.findEntityById(req.getConvenioId()));
    }

    return modelMapper.map(repository.save(entity), PacienteResponse.class);
}
```

**5. Adicionar `findEntityById` no `ConvenioService`** (package-private, só para uso interno):

```java
ConvenioEntity findEntityById(Long id) {
    return repository.findById(id)
        .orElseThrow(() -> new EntityNotFoundException("Convênio", id));
}
```

### Validação

```bash
# Criar paciente SEM convênio
curl -s -X POST http://localhost:8081/v1/pacientes \
  -H "Content-Type: application/json" \
  -d '{"nome":"Ana Costa","email":"ana@email.com","cpf":"11122233344","telefone":"31988880001","dataNascimento":"1990-05-15"}' | jq .
# → sucesso, convenio: null

# Criar paciente COM convênio (id=1 criado no PASSO 3)
curl -s -X POST http://localhost:8081/v1/pacientes \
  -H "Content-Type: application/json" \
  -d '{"nome":"Carlos Lima","email":"carlos@email.com","cpf":"55566677788","convenioId":1}' | jq .
# → sucesso, convenio: { "id": 1, "nome": "Unimed" }

# /exists (usado pelo agendamento)
curl -s http://localhost:8081/v1/pacientes/1/exists | jq .
# → {"exists":true}

# CPF duplicado — deve retornar 422
curl -s -X POST http://localhost:8081/v1/pacientes \
  -H "Content-Type: application/json" \
  -d '{"nome":"Outro","email":"outro@email.com","cpf":"11122233344"}' | jq .
# → {"success":false,"message":"CPF já cadastrado"}

# ConvênioId inexistente — deve retornar 404
curl -s -X POST http://localhost:8081/v1/pacientes \
  -H "Content-Type: application/json" \
  -d '{"nome":"Teste","email":"t@t.com","cpf":"99988877766","convenioId":999}' | jq .
# → {"success":false,"message":"Convênio com id 999 não encontrado"}
```

**Verificar banco — FK nullable:**
```bash
docker compose exec mysql mysql -uroot clinica_administrativo \
  -e "SELECT id, nome, cpf, convenio_id FROM pacientes;"
# Deve mostrar: Ana (convenio_id=NULL) e Carlos (convenio_id=1)
```

### Ponto de controle — avance somente quando:

- [ ] Criar paciente sem convênio → sucesso, `convenio: null` no response
- [ ] Criar paciente com `convenioId` válido → sucesso, objeto convênio aninhado no response
- [ ] Criar paciente com `convenioId` inválido → 404
- [ ] `GET /v1/pacientes/{id}/exists` funcionando corretamente
- [ ] CPF e e-mail duplicados retornam 422 com mensagem de negócio
- [ ] Tabela `pacientes` com `convenio_id` nullable (verificar `DESCRIBE pacientes`)

---

## PASSO 6 — Auth: tabela de usuários e emissão de JWT [2h]

> Implementar o mecanismo de autenticação: entidade `Usuario`, geração de tokens JWT e endpoint de login.
> **A segurança ainda não está ativa** — os endpoints existentes continuam abertos até o PASSO 7.

**Depende de:** PASSO 5 concluído.
**Doc detalhado:** [`08-SEGURANCA.md`](08-SEGURANCA.md) § Parte 1.

### Por que Auth vem antes de Security

Você precisa de um token para testar o Security. Faça o emissor primeiro, depois o validador.

### O que fazer

**1. Criar a estrutura:**

```
administrativo/.../auth/
├── UsuarioEntity.java
├── UsuarioRepository.java
├── enums/
│   └── Role.java
├── JwtService.java
├── AuthService.java
├── AuthController.java
└── dto/
    ├── LoginRequest.java      ← record { @Email String email; @NotBlank String senha; }
    ├── LoginResponse.java     ← record { String token; long expiresIn; String email; Role role; }
    ├── RegisterRequest.java
    └── UsuarioResponse.java
```

**2. `Role` enum:**

```java
public enum Role { ADMIN, RECEPCIONISTA, MEDICO, PACIENTE }
```

**3. `UsuarioEntity`** — senha armazenada como hash BCrypt, nunca em texto plano:

```java
@Entity
@Table(name = "usuarios", uniqueConstraints = @UniqueConstraint(columnNames = "email"))
public class UsuarioEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false, length = 150) private String nome;
    @Column(nullable = false, length = 200) private String email;
    @Column(nullable = false)               private String senhaHash;   // BCrypt

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role;

    @Column(nullable = false, updatable = false) private LocalDateTime createdAt;
    @PrePersist void onCreate() { createdAt = LocalDateTime.now(); }
}
```

**4. `JwtService`** — geração do token:

```java
@Service
public class JwtService {
    private final SecretKey key;
    private final long expirationMillis;

    public JwtService(@Value("${jwt.secret}") String secret,
                      @Value("${jwt.expiration:3600000}") long exp) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMillis = exp;
    }

    public String generate(UsuarioEntity user) {
        Date now = new Date();
        return Jwts.builder()
            .issuer("clinica-medica")
            .subject(user.getEmail())
            .claim("uid",  user.getId())
            .claim("nome", user.getNome())
            .claim("role", user.getRole().name())
            .issuedAt(now)
            .expiration(new Date(now.getTime() + expirationMillis))
            .signWith(key)
            .compact();
    }
}
```

**5. `AuthController`** — endpoint público de login:

```java
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService service;

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(@Valid @RequestBody LoginRequest req) {
        return ResponseEntity.ok(ApiResponse.success("Login bem-sucedido", service.login(req)));
    }

    @PostMapping("/register")  // vai ser protegido no PASSO 7 com @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<UsuarioResponse>> register(@Valid @RequestBody RegisterRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ApiResponse.success("Usuário criado", service.register(req)));
    }
}
```

**6. Seed do admin** — `CommandLineRunner` no `AdministrativoApplication`:

```java
@Bean
@Profile("!test")
CommandLineRunner seedAdmin(UsuarioRepository repo, PasswordEncoder encoder) {
    return args -> {
        if (!repo.existsByEmail("admin@clinica.com")) {
            repo.save(UsuarioEntity.builder()
                .nome("Administrador")
                .email("admin@clinica.com")
                .senhaHash(encoder.encode("admin123"))
                .role(Role.ADMIN)
                .build());
        }
    };
}
```

**7. Bean `PasswordEncoder`** — em qualquer `@Configuration`:

```java
@Bean
public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();
}
```

### Validação

```bash
# Fazer login com o admin criado pelo seed
curl -s -X POST http://localhost:8081/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clinica.com","senha":"admin123"}' | jq .
```

Saída esperada:
```json
{
  "success": true,
  "message": "Login bem-sucedido",
  "data": {
    "token": "eyJhbGciOiJIUzM4NC...",
    "expiresIn": 3600,
    "email": "admin@clinica.com",
    "role": "ADMIN"
  }
}
```

```bash
# Guardar o token numa variável para os próximos testes
TOKEN=$(curl -s -X POST http://localhost:8081/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clinica.com","senha":"admin123"}' | jq -r '.data.token')

echo $TOKEN   # deve imprimir o JWT

# Login com senha errada — deve retornar 422
curl -s -X POST http://localhost:8081/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clinica.com","senha":"errada"}' | jq .
# → {"success":false,"message":"Credenciais inválidas"}
```

**Verificar banco:**
```bash
docker compose exec mysql mysql -uroot clinica_administrativo \
  -e "SELECT id, nome, email, role FROM usuarios;"
# → Deve mostrar o admin
```

### Ponto de controle — avance somente quando:

- [ ] `POST /auth/login` com credenciais corretas retorna um JWT válido (string `eyJ...`)
- [ ] `POST /auth/login` com senha errada retorna 422 com mensagem genérica (nunca diga qual campo está errado — evita user enumeration)
- [ ] Tabela `usuarios` existe com o admin seedado
- [ ] O JWT tem o claim `role` visível (decodifique em `jwt.io` para verificar)

---

## PASSO 7 — Spring Security: filter JWT + autorização por role [1h30]

> Ativar a proteção de todos os endpoints. Após este passo, qualquer requisição
> sem `Authorization: Bearer <token>` retornará 401.

**Depende de:** PASSO 6 concluído (precisa do `JwtService` e do token para testar).
**Doc detalhado:** [`08-SEGURANCA.md`](08-SEGURANCA.md) § Parte 3.

### O que fazer

**1. Criar o filtro JWT (`JwtAuthFilter`):**

```java
@Component
public class JwtAuthFilter extends OncePerRequestFilter {
    private final SecretKey key;

    public JwtAuthFilter(@Value("${jwt.secret}") String secret) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            try {
                Claims claims = Jwts.parser().verifyWith(key).build()
                    .parseSignedClaims(header.substring(7)).getPayload();
                String role = claims.get("role", String.class);
                var auth = new UsernamePasswordAuthenticationToken(
                    claims.getSubject(), null,
                    List.of(new SimpleGrantedAuthority("ROLE_" + role))
                );
                SecurityContextHolder.getContext().setAuthentication(auth);
            } catch (Exception e) {
                // Token inválido: não seta autenticação, o SecurityConfig vai retornar 401
            }
        }
        chain.doFilter(request, response);
    }
}
```

**2. Criar o `SecurityConfig`:**

```java
@Configuration
@EnableMethodSecurity    // habilita @PreAuthorize nos controllers
@RequiredArgsConstructor
public class SecurityConfig {
    private final JwtAuthFilter jwtFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // Endpoints públicos — nunca exigem JWT
                .requestMatchers("/auth/login").permitAll()
                .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                .requestMatchers("/actuator/health").permitAll()
                // Endpoints de uso interno entre serviços (Feign) — sem JWT
                .requestMatchers("/v1/pacientes/*/exists", "/v1/medicos/*/exists").permitAll()
                // Tudo mais exige autenticação
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
            .build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
```

**3. Adicionar `@PreAuthorize` nos controllers:**

```java
// ConvenioController
@GetMapping    @PreAuthorize("hasAnyRole('ADMIN','RECEPCIONISTA')")
@PostMapping   @PreAuthorize("hasRole('ADMIN')")
@PutMapping    @PreAuthorize("hasRole('ADMIN')")
@DeleteMapping @PreAuthorize("hasRole('ADMIN')")

// MedicoController e PacienteController — mesma lógica
// AuthController.register
@PostMapping("/register") @PreAuthorize("hasRole('ADMIN')")
```

### Validação

```bash
# Guardar o token do admin
TOKEN=$(curl -s -X POST http://localhost:8081/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clinica.com","senha":"admin123"}' | jq -r '.data.token')

# 1. Sem token → 401
curl -s -o /dev/null -w "%{http_code}" http://localhost:8081/v1/convenios
# → 401

# 2. Com token válido → 200
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8081/v1/convenios | jq .
# → {"success":true,"data":[...]}

# 3. Token inválido → 401
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer token.invalido.aqui" \
  http://localhost:8081/v1/convenios
# → 401

# 4. Endpoints /exists são públicos (sem token)
curl -s http://localhost:8081/v1/pacientes/1/exists | jq .
# → {"exists":true}  (sem Authorization header)

# 5. Criar usuário RECEPCIONISTA e testar role
curl -s -X POST http://localhost:8081/auth/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"nome":"Maria Recep","email":"maria@clinica.com","senha":"senha123","role":"RECEPCIONISTA"}' | jq .

# Login como recepcionista
TOKEN_REC=$(curl -s -X POST http://localhost:8081/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"maria@clinica.com","senha":"senha123"}' | jq -r '.data.token')

# Recepcionista pode listar → 200
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN_REC" \
  http://localhost:8081/v1/convenios
# → 200

# Recepcionista NÃO pode deletar → 403
curl -s -o /dev/null -w "%{http_code}" \
  -X DELETE -H "Authorization: Bearer $TOKEN_REC" \
  http://localhost:8081/v1/convenios/1
# → 403
```

### Ponto de controle — avance somente quando:

- [ ] `GET /v1/convenios` sem token → `401`
- [ ] `GET /v1/convenios` com token ADMIN → `200`
- [ ] `GET /v1/convenios` com token inválido → `401`
- [ ] `DELETE /v1/convenios/{id}` com token RECEPCIONISTA → `403`
- [ ] `GET /v1/pacientes/1/exists` sem token → `200` (endpoint público)
- [ ] `GET /actuator/health` sem token → `200` (endpoint público)
- [ ] Swagger UI acessível sem token: `http://localhost:8081/swagger-ui.html`

---

## PASSO 8 — Checkpoint: `administrativo` completo [30 min]

> Antes de partir para os outros serviços, validar o `administrativo` de ponta a ponta.
> Este é o ponto de não retorno — os próximos serviços dependem deste estar 100%.

### Fluxo completo de validação

Execute este script completo. Se qualquer passo falhar, volte e corrija antes de continuar.

```bash
# Setup: obter token admin
TOKEN=$(curl -s -X POST http://localhost:8081/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clinica.com","senha":"admin123"}' | jq -r '.data.token')

echo "--- [1/5] Criar dados mestres ---"
CONVENIO_ID=$(curl -s -X POST http://localhost:8081/v1/convenios \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"nome":"Unimed","descricao":"Plano Ouro"}' | jq -r '.data.id')

MEDICO_ID=$(curl -s -X POST http://localhost:8081/v1/medicos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"nome":"Dr. Carlos","email":"carlos@clinica.com","crm":"CRM/MG 111111","especialidade":"Clínica Geral"}' | jq -r '.data.id')

PACIENTE_ID=$(curl -s -X POST http://localhost:8081/v1/pacientes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"nome\":\"João Silva\",\"email\":\"joao@email.com\",\"cpf\":\"12345678901\",\"convenioId\":$CONVENIO_ID}" \
  | jq -r '.data.id')

echo "Convênio: $CONVENIO_ID | Médico: $MEDICO_ID | Paciente: $PACIENTE_ID"

echo "--- [2/5] Endpoints /exists (públicos) ---"
curl -s "http://localhost:8081/v1/medicos/$MEDICO_ID/exists" | jq .
curl -s "http://localhost:8081/v1/pacientes/$PACIENTE_ID/exists" | jq .

echo "--- [3/5] Controle de acesso ---"
echo "Sem token (deve ser 401):"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8081/v1/convenios

echo "--- [4/5] Banco de dados ---"
docker compose exec mysql mysql -uroot clinica_administrativo \
  -e "SELECT 'convenios' as tabela, COUNT(*) as registros FROM convenios
      UNION SELECT 'medicos', COUNT(*) FROM medicos
      UNION SELECT 'pacientes', COUNT(*) FROM pacientes
      UNION SELECT 'usuarios', COUNT(*) FROM usuarios;"

echo "--- [5/5] Swagger ---"
curl -s -o /dev/null -w "Swagger: %{http_code}\n" http://localhost:8081/swagger-ui.html
```

### Ponto de controle — avance somente quando:

- [ ] Todos os 4 módulos de domínio funcionando (Convênio, Médico, Paciente, Auth)
- [ ] Spring Security ativo: 401 sem token, 403 por role insuficiente
- [ ] `/exists` retorna corretamente sem token
- [ ] 4 tabelas no banco com dados
- [ ] Swagger acessível

---

## PASSO 9 — Validar o `administrativo` em container Docker [30 min]

> Confirmar que o container funciona igual à IDE.
> Já temos o `Dockerfile` e o `docker-compose.yml` prontos.

### O que fazer

```bash
# Parar o serviço na IDE primeiro (liberar a porta 8081)

# Subir tudo via Docker
docker compose up --build -d

# Acompanhar os logs até o Spring Boot subir
docker compose logs -f administrativo
# Aguardar: "Started AdministrativoApplication in X.XXX seconds"
```

### Validação

```bash
# O mesmo teste do PASSO 8, agora contra o container
TOKEN=$(curl -s -X POST http://localhost:8081/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clinica.com","senha":"admin123"}' | jq -r '.data.token')

curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8081/v1/convenios | jq .
# → {"success":true,"data":[...]}

# Verificar healthcheck do container
docker compose ps
# administrativo deve estar "Up" com healthcheck passando (se Actuator configurado)
```

### Ponto de controle — avance somente quando:

- [ ] `docker compose up --build` termina sem erros
- [ ] `POST /auth/login` funciona contra o container (porta 8081)
- [ ] `docker compose down` para tudo limpo

---

## PASSO 10 — Serviço `agendamento` [3h]

> Implementar o serviço de agendamentos: entidade, CRUD, Feign client para o `administrativo` e Security.

**Depende de:** PASSO 8 concluído (`/exists` do administrativo em funcionamento).
**Doc detalhado:** [`05-AGENDAMENTO.md`](05-AGENDAMENTO.md)

### Por que o agendamento vem aqui

O `agendamento` precisa validar se o paciente e o médico existem chamando o `administrativo` via Feign. Sem o administrativo estável e com os endpoints `/exists` funcionando, é impossível testar.

### O que fazer

**1. Atualizar `agendamento/pom.xml`** — adicionar as mesmas dependências do administrativo (Web, JPA, MySQL, commons, Security, JWT, Feign, Swagger, Logbook, Actuator, Testcontainers). Ver pom.xml completo em [`05-AGENDAMENTO.md`](05-AGENDAMENTO.md).

**2. Criar `agendamento/src/main/resources/application.yml`:**

```yaml
server:
  port: ${SERVER_PORT:8082}

spring:
  application:
    name: agendamento
  datasource:
    url: jdbc:mysql://${DB_HOST:localhost}:${DB_PORT:3308}/${DB_NAME:clinica_agendamento}?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=America/Sao_Paulo
    username: ${DB_USER:root}
    password: ${DB_PASSWORD:}
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: ${JPA_SHOW_SQL:false}

administrativo:
  url: ${ADMINISTRATIVO_URL:http://localhost:8081}

jwt:
  secret: ${JWT_SECRET:dev-secret-please-change-in-production-com-256-bits-no-minimo}
```

**Atenção:** porta `3308` e banco `clinica_agendamento`. O `init.sql` já criou esse banco.

**3. Atualizar `AgendamentoApplication`:**

```java
@SpringBootApplication(scanBasePackages = "br.edu.imepac")
@EnableFeignClients(basePackages = "br.edu.imepac.agendamento.client")
public class AgendamentoApplication { ... }
```

**4. Implementar em ordem:**

```
agendamento/.../agendamento/
├── enums/StatusAgendamento.java
├── AgendamentoEntity.java
├── AgendamentoRepository.java
├── AgendamentoService.java
├── AgendamentoController.java
└── dto/ [Request, UpdateRequest, Response]

agendamento/.../client/
├── AdministrativoClient.java   ← @FeignClient
└── FeignConfig.java            ← ErrorDecoder

agendamento/.../security/
├── JwtAuthFilter.java          ← cópia do administrativo
└── SecurityConfig.java         ← similar ao administrativo (sem /auth/login)
```

**5. `AdministrativoClient`** — chamadas Feign:

```java
@FeignClient(name = "administrativo",
             url = "${administrativo.url}",
             configuration = FeignConfig.class)
public interface AdministrativoClient {

    @GetMapping("/v1/pacientes/{id}/exists")
    ExistsResponse pacienteExiste(@PathVariable Long id);

    @GetMapping("/v1/medicos/{id}/exists")
    ExistsResponse medicoExiste(@PathVariable Long id);
}
```

**6. `FeignConfig` com `ErrorDecoder`** — tradução de HTTP em exceções:

```java
@Bean
public ErrorDecoder errorDecoder() {
    return (methodKey, response) -> switch (response.status()) {
        case 404 -> new EntityNotFoundException("Recurso não encontrado: " + methodKey);
        case 502, 503, 504 -> new FeignIntegrationException(methodKey, "Serviço indisponível");
        default -> new FeignIntegrationException(methodKey, "HTTP " + response.status());
    };
}
```

**7. `AgendamentoService.criar`** — validações antes de salvar:

```java
public AgendamentoResponse criar(AgendamentoRequest req) {
    // 1. Paciente existe?
    if (!administrativoClient.pacienteExiste(req.getPacienteId()).exists())
        throw new EntityNotFoundException("Paciente", req.getPacienteId());

    // 2. Médico existe?
    if (!administrativoClient.medicoExiste(req.getMedicoId()).exists())
        throw new EntityNotFoundException("Médico", req.getMedicoId());

    // 3. Horário livre para o médico?
    if (repository.existsByMedicoIdAndDataHoraAndStatusIn(
            req.getMedicoId(), req.getDataHora(), List.of(AGENDADO, CONFIRMADO)))
        throw new BusinessException("Médico já tem agendamento ativo nesse horário");

    // 4. Salvar
    AgendamentoEntity entity = modelMapper.map(req, AgendamentoEntity.class);
    entity.setStatus(StatusAgendamento.AGENDADO);
    return modelMapper.map(repository.save(entity), AgendamentoResponse.class);
}
```

### Validação

Com o `administrativo` rodando na 8081 e o `agendamento` na 8082:

```bash
# Token do administrativo (JWT_SECRET deve ser o mesmo nos dois serviços)
TOKEN=$(curl -s -X POST http://localhost:8081/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clinica.com","senha":"admin123"}' | jq -r '.data.token')

# Criar agendamento com paciente e médico válidos
curl -s -X POST http://localhost:8082/v1/agendamentos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"pacienteId\":1,\"medicoId\":1,\"dataHora\":\"$(date -d '+30 days' +%Y-%m-%dT10:00:00)\",\"observacoes\":\"Consulta de rotina\"}" \
  | jq .
# → {"success":true,"message":"Agendamento criado","data":{...,"status":"AGENDADO"}}

# Paciente inexistente — deve retornar 404
curl -s -X POST http://localhost:8082/v1/agendamentos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"pacienteId":99999,"medicoId":1,"dataHora":"2030-01-01T10:00:00"}' | jq .
# → {"success":false,"message":"Paciente com id 99999 não encontrado"}

# Conflito de horário — criar segundo agendamento no mesmo horário e médico
# (deve retornar 422)

# Sem token → 401
curl -s -o /dev/null -w "%{http_code}" http://localhost:8082/v1/agendamentos
# → 401

# Verificar tabela no banco
docker compose exec mysql mysql -uroot clinica_agendamento \
  -e "SELECT id, paciente_id, medico_id, status, data_hora FROM agendamentos;"
```

### Ponto de controle — avance somente quando:

- [ ] `POST /v1/agendamentos` com paciente e médico válidos → 201 com status `AGENDADO`
- [ ] `POST /v1/agendamentos` com `pacienteId` inválido → 404 (via Feign ErrorDecoder)
- [ ] Conflito de horário → 422
- [ ] Sem token → 401
- [ ] Tabela `agendamentos` criada em `clinica_agendamento`
- [ ] `GET /v1/agendamentos/{id}` retorna o agendamento criado (o `atendimento` vai chamar este endpoint)

---

## PASSO 11 — Serviço `atendimento` [2h]

> Registrar o atendimento clínico (diagnóstico + prescrição), validando o agendamento via Feign.

**Depende de:** PASSO 10 concluído (`GET /v1/agendamentos/{id}` do agendamento funcionando).
**Doc detalhado:** [`06-ATENDIMENTO.md`](06-ATENDIMENTO.md)

### O que fazer

A estrutura é idêntica ao `agendamento`. Diferenças:

- Porta: `8083`, banco `clinica_atendimento`, porta MySQL `3309`
- Feign client chama `agendamento` (não `administrativo`)
- `agendamentoId` é **UNIQUE** na tabela — 1 agendamento gera 1 atendimento no máximo
- `pacienteId` e `medicoId` são **denormalizados** (copiados do agendamento para evitar chamada Feign nas leituras)

**`AgendamentoClient` (Feign do atendimento):**

```java
@FeignClient(name = "agendamento", url = "${agendamento.url}", configuration = FeignConfig.class)
public interface AgendamentoClient {

    @GetMapping("/v1/agendamentos/{id}")
    ApiResponse<AgendamentoSnapshot> buscar(@PathVariable Long id);

    record AgendamentoSnapshot(Long id, Long pacienteId, Long medicoId,
                               LocalDateTime dataHora, String status) {}
}
```

**`AtendimentoService.registrar` — lógica central:**

```java
public AtendimentoResponse registrar(AtendimentoRequest req) {
    // 1. Já existe atendimento para este agendamento?
    if (repository.existsByAgendamentoId(req.getAgendamentoId()))
        throw new BusinessException("Já existe atendimento para este agendamento");

    // 2. Buscar agendamento via Feign
    var snapshot = agendamentoClient.buscar(req.getAgendamentoId()).getData();

    // 3. Status válido para atendimento?
    if (!"AGENDADO".equals(snapshot.status()) && !"CONFIRMADO".equals(snapshot.status()))
        throw new BusinessException("Agendamento em status inválido: " + snapshot.status());

    // 4. Montar entidade (desnormalizar pacienteId e medicoId)
    AtendimentoEntity entity = AtendimentoEntity.builder()
        .agendamentoId(req.getAgendamentoId())
        .pacienteId(snapshot.pacienteId())
        .medicoId(snapshot.medicoId())
        .diagnostico(req.getDiagnostico())
        .prescricao(req.getPrescricao())
        .observacoes(req.getObservacoes())
        .build();

    return modelMapper.map(repository.save(entity), AtendimentoResponse.class);
}
```

### Validação

```bash
TOKEN=$(curl -s -X POST http://localhost:8081/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clinica.com","senha":"admin123"}' | jq -r '.data.token')

# Registrar atendimento para o agendamento 1
curl -s -X POST http://localhost:8083/v1/atendimentos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"agendamentoId":1,"diagnostico":"Hipertensão leve","prescricao":"Losartana 50mg"}' \
  | jq .
# → {"success":true,"message":"Atendimento registrado","data":{...}}

# Tentar registrar de novo (duplicado) → 422
curl -s -X POST http://localhost:8083/v1/atendimentos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"agendamentoId":1,"diagnostico":"X","prescricao":"Y"}' | jq .
# → {"success":false,"message":"Já existe atendimento para este agendamento"}

# Agendamento inexistente → 404 (via Feign ErrorDecoder)
curl -s -X POST http://localhost:8083/v1/atendimentos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"agendamentoId":99999,"diagnostico":"X","prescricao":"Y"}' | jq .
# → {"success":false,"message":"...não encontrado"}
```

### Ponto de controle — avance somente quando:

- [ ] `POST /v1/atendimentos` cria atendimento com sucesso
- [ ] Tentativa de duplicata → 422
- [ ] Agendamento inexistente → 404 via Feign
- [ ] Tabela `atendimentos` com `agendamento_id UNIQUE`

---

## PASSO 12 — API Gateway [2h]

> Criar o módulo `gateway`: porta única de entrada, roteamento por path e validação JWT centralizada.

**Depende de:** PASSOS 10 e 11 concluídos (todos os serviços devem estar no ar).
**Doc detalhado:** [`07-GATEWAY.md`](07-GATEWAY.md)

### O que fazer

**1. Criar o módulo `gateway`:**

```bash
# Estrutura mínima
mkdir -p gateway/src/main/java/br/edu/imepac/gateway/security
mkdir -p gateway/src/main/resources
```

Adicionar `<module>gateway</module>` no `pom.xml` raiz.

**2. `gateway/pom.xml`** — Spring Cloud Gateway usa WebFlux (não Spring MVC):

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-gateway</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-security</artifactId>
</dependency>
<!-- JWT, Lombok, Tests — mesmos do administrativo -->
```

**Atenção: o gateway NÃO importa o `commons`.** O commons usa Spring MVC. O gateway usa WebFlux. Misturar quebra a auto-configuration. Se precisar de `ApiResponse`, redeclare local.

**3. `application.yml` do gateway** — rotas e JWT:

```yaml
server:
  port: ${SERVER_PORT:8080}
spring:
  application:
    name: gateway
  cloud:
    gateway:
      routes:
        - id: auth
          uri: ${ADMINISTRATIVO_URL:http://localhost:8081}
          predicates: [Path=/auth/**]

        - id: administrativo
          uri: ${ADMINISTRATIVO_URL:http://localhost:8081}
          predicates: [Path=/api/admin/**]
          filters: [StripPrefix=2]

        - id: agendamento
          uri: ${AGENDAMENTO_URL:http://localhost:8082}
          predicates: [Path=/api/agendamentos/**]
          filters: [StripPrefix=2]

        - id: atendimento
          uri: ${ATENDIMENTO_URL:http://localhost:8083}
          predicates: [Path=/api/atendimentos/**]
          filters: [StripPrefix=2]
jwt:
  secret: ${JWT_SECRET:dev-secret-please-change-in-production-com-256-bits-no-minimo}
```

**Sobre `StripPrefix=2`:** o cliente chama `/api/admin/v1/convenios`. O gateway corta os 2 primeiros segmentos e encaminha `/v1/convenios` para o backend.

**4. `JwtAuthenticationFilter` (WebFlux — usa `Mono`, não `void`):**

Ver implementação completa em [`08-SEGURANCA.md`](08-SEGURANCA.md) § Gateway.

### Validação

```bash
# Subir o gateway na porta 8080
mvn spring-boot:run -pl gateway

# Login via gateway (roteia para administrativo)
TOKEN=$(curl -s -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clinica.com","senha":"admin123"}' | jq -r '.data.token')

echo "Token obtido: $TOKEN"

# Listar convênios via gateway (roteia para administrativo:8081)
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/admin/v1/convenios | jq .

# Listar agendamentos via gateway (roteia para agendamento:8082)
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/agendamentos/v1/agendamentos | jq .

# Sem token → 401
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/admin/v1/convenios
# → 401
```

### Ponto de controle — avance somente quando:

- [ ] `POST http://localhost:8080/auth/login` retorna JWT
- [ ] Todas as rotas `/api/admin/**`, `/api/agendamentos/**`, `/api/atendimentos/**` funcionando
- [ ] Sem token → 401 no gateway
- [ ] Os microsserviços continuam funcionando diretamente (8081, 8082, 8083)

---

## PASSO 13 — Stack Docker completa [1h]

> Migrar o `docker-compose.yml` para o modelo com 3 MySQLs e todos os serviços.

**Depende de:** PASSO 12 concluído.
**Doc detalhado:** [`09-DOCKER.md`](09-DOCKER.md) § Stack Completa.

### O que fazer

1. Substituir o `docker-compose.yml` pelo modelo completo documentado em [`09-DOCKER.md`](09-DOCKER.md).
2. Adicionar `gateway/pom.xml` ao COPY de pom.xml do Dockerfile.
3. Criar/atualizar o `.env` com `JWT_SECRET` e `MYSQL_ROOT_PASSWORD`.

```bash
docker compose down -v          # limpa tudo
docker compose up --build -d    # sobe a stack completa

# Acompanhar até tudo estar healthy
docker compose ps
```

### Validação — fluxo completo de ponta a ponta

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clinica.com","senha":"admin123"}' | jq -r '.data.token')

# Criar convênio
curl -s -X POST http://localhost:8080/api/admin/v1/convenios \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"nome":"Bradesco Saúde","descricao":"Plano Executivo"}' | jq .

# Criar médico
curl -s -X POST http://localhost:8080/api/admin/v1/medicos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"nome":"Dra. Ana Lima","email":"ana@clinica.com","crm":"CRM/SP 999999","especialidade":"Cardiologia"}' | jq .

# Criar paciente
curl -s -X POST http://localhost:8080/api/admin/v1/pacientes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"nome":"Pedro Santos","email":"pedro@email.com","cpf":"98765432100","convenioId":1}' | jq .

# Criar agendamento
AGEND_ID=$(curl -s -X POST http://localhost:8080/api/agendamentos/v1/agendamentos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"pacienteId":1,"medicoId":1,"dataHora":"2030-06-15T14:00:00","observacoes":"Consulta de rotina"}' \
  | jq -r '.data.id')

echo "Agendamento criado: $AGEND_ID"

# Registrar atendimento
curl -s -X POST http://localhost:8080/api/atendimentos/v1/atendimentos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"agendamentoId\":$AGEND_ID,\"diagnostico\":\"Paciente saudável\",\"prescricao\":\"Nenhuma\"}" | jq .
```

### Ponto de controle — avance somente quando:

- [ ] `docker compose ps` mostra todos os 7 containers healthy/running
- [ ] Fluxo completo (convênio → médico → paciente → agendamento → atendimento) funciona via gateway
- [ ] `docker compose down -v` limpa tudo sem erros

---

## PASSO 14 — Testes [4h]

> Cobrir cada camada com testes automatizados. Este passo pode ser feito em paralelo
> com a implementação de cada módulo se preferir o estilo TDD.

**Doc detalhado:** [`11-TESTES.md`](11-TESTES.md)

### Pirâmide de testes

| Tipo | Onde | Ferramenta | % do total |
|---|---|---|---|
| Unidade | `*Service` | JUnit 5 + Mockito | ~70% |
| Integração | `*Controller` | MockMvc + Testcontainers | ~25% |
| End-to-end | Postman/Newman | n/a | ~5% |

### Casos obrigatórios por serviço

Para cada `*Service`, escreva testes de:
- Happy path (sucesso)
- Entidade não encontrada → `EntityNotFoundException`
- Regra de negócio violada → `BusinessException`
- Feign retorna false/erro → tratamento correto

Para cada `*Controller`, escreva testes de:
- `400` — validation error (campo obrigatório vazio)
- `401` — sem token
- `403` — role insuficiente
- `404` — entidade não encontrada
- `422` — regra de negócio
- `201/200` — happy path

```bash
# Rodar todos os testes
mvn test

# Rodar testes de um módulo específico
mvn test -pl administrativo

# Gerar relatório de cobertura (requer JaCoCo no pom.xml)
mvn verify
# Relatório em: */target/site/jacoco/index.html
```

---

## PASSO 15 — CI/CD e polimento [2h]

> Automatizar o pipeline e finalizar a documentação.

**Doc detalhado:** [`10-CICD.md`](10-CICD.md)

### O que fazer

1. Criar `.github/workflows/ci.yml` — build e testes em todo PR/push.
2. Criar `.github/workflows/docker.yml` — build e push das imagens para GHCR.
3. Ativar status check obrigatório no `main`.
4. Adicionar badges no `README.md`.
5. Revisar Swagger em todos os serviços (anotações `@Tag`, `@Operation`, `@Schema`).

---

## Resumo de tempos

| Passo | Tema | Tempo |
|---|---|---|
| 0 | Diagnóstico inicial | 30 min |
| 1 | commons refatorado | 2h |
| 2 | administrativo: pom + yml | 30 min |
| 3 | Convênio | 1h |
| 4 | Médico | 45 min |
| 5 | Paciente | 1h30 |
| 6 | Auth + JWT | 2h |
| 7 | Spring Security | 1h30 |
| 8 | Checkpoint administrativo | 30 min |
| 9 | Docker dev | 30 min |
| 10 | agendamento | 3h |
| 11 | atendimento | 2h |
| 12 | gateway | 2h |
| 13 | Docker completo | 1h |
| 14 | Testes | 4h |
| 15 | CI/CD + polimento | 2h |
| **Total** | | **~27h** |

---

## Definition of Done

O projeto está concluído quando estes 7 critérios forem verdadeiros simultaneamente:

1. `docker compose up --build` sobe todos os 7 containers sem erros.
2. `POST /auth/login` via gateway retorna JWT válido.
3. Com o token: convênio → médico → paciente → agendamento → atendimento funcionam ponta a ponta.
4. Sem token: qualquer endpoint privado retorna `401`. Role errada retorna `403`.
5. `mvn test` passa em todos os módulos.
6. CI verde no GitHub Actions para todo push em `main`.
7. Swagger acessível em cada serviço sem autenticação.

---

## Por onde começar

Vá para [`03-COMMONS.md`](03-COMMONS.md) e execute o **PASSO 1**.
