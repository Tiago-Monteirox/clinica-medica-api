# 12 — Referência de Tecnologias

> Aprofundamento de cada peça da stack. Use como **glossário/consulta** durante a implementação. Inspirado no `GUIA_TECNOLOGIAS.md` do `app-order-service`.

---

## Sumário

1. [Maven multi-módulo](#1-maven-multi-módulo)
2. [Spring Boot](#2-spring-boot)
3. [Spring MVC (REST)](#3-spring-mvc-rest)
4. [Spring Data JPA + Hibernate](#4-spring-data-jpa--hibernate)
5. [MySQL 8](#5-mysql-8)
6. [Lombok](#6-lombok)
7. [Bean Validation](#7-bean-validation)
8. [ModelMapper](#8-modelmapper)
9. [Spring Cloud OpenFeign](#9-spring-cloud-openfeign)
10. [Spring Cloud Gateway](#10-spring-cloud-gateway)
11. [Spring Security + JJWT](#11-spring-security--jjwt)
12. [SpringDoc OpenAPI (Swagger)](#12-springdoc-openapi-swagger)
13. [Logbook](#13-logbook)
14. [Jackson](#14-jackson)
15. [JUnit 5 + Mockito + AssertJ](#15-junit-5--mockito--assertj)
16. [Testcontainers](#16-testcontainers)
17. [Docker](#17-docker)
18. [GitHub Actions](#18-github-actions)
19. [Tipos Java fundamentais](#19-tipos-java-fundamentais)
20. [Spring Auto-configuration](#20-spring-auto-configuration)

---

## 1. Maven multi-módulo

**Papel:** orquestra o build de vários artefatos (commons + 4 serviços) em um repositório único, com versões e dependências compartilhadas.

**Conceitos:**

- **POM pai (parent):** define `<packaging>pom</packaging>`, lista `<modules>`, declara `dependencyManagement` (versões), e `pluginManagement`.
- **POM filho:** declara `<parent>` apontando para o pai, e só lista as deps que **usa** (sem versão — herda do pai).
- **`dependencyManagement` vs `dependencies`:** o primeiro só **gerencia versões**; o segundo **inclui** a dep no classpath. No pai, use management; no filho, dependencies.
- **BOM (Bill of Materials):** um POM `import`-ado em management que traz versões coordenadas de várias deps. Spring Boot, Spring Cloud, Testcontainers usam.
- **Scopes:** `compile` (default), `runtime` (precisa só ao rodar — ex: driver JDBC), `provided` (compila mas não embala — ex: APIs que o container provê), `test` (só nos testes).
- **`-pl <modulo>` (project list):** roda Maven só nesse módulo. `-am` (also-make) inclui as dependências internas necessárias.

**Comandos úteis:**

```bash
mvn clean install                    # builda tudo, instala no ~/.m2
mvn clean install -DskipTests        # sem testes
mvn -pl administrativo -am test      # só administrativo (e seus deps)
mvn dependency:tree -pl agendamento  # mostra árvore de dependências
mvn help:effective-pom -pl commons   # mostra o POM efetivo (após herança)
```

**Alternativas:** Gradle (mais flexível, sintaxe Groovy/Kotlin), Bazel (escala maior).

---

## 2. Spring Boot

**Versão:** 3.3.5 (compatível com Java 21 neste projeto).

**Papel:** framework que reduz boilerplate do Spring Framework via **convention over configuration** + auto-configuration.

**Componentes-chave:**

- `@SpringBootApplication` = `@Configuration + @EnableAutoConfiguration + @ComponentScan`. Coloca na classe `main()`.
- **Starters:** dependências agregadoras. `spring-boot-starter-web` traz Spring MVC + Tomcat embedded + Jackson + Validation (depende do BOM).
- **Embedded server:** Tomcat default, Netty no WebFlux. Sobe com a aplicação, sem WAR.
- **Auto-configuration:** carrega beans condicionalmente. Ex: se há `DataSource` + `EntityManager` no classpath, ativa JPA. Veja com `--debug` ou `actuator/conditions`.
- **`application.yml/properties`:** override de defaults. Hierarquia: env vars > system props > arquivo > defaults.
- **`@Profile("dev")`** + `application-dev.yml`: configurações específicas por ambiente.

**`@SpringBootApplication(scanBasePackages = "br.edu.imepac")`** garante que o commons seja escaneado.

---

## 3. Spring MVC (REST)

**Anotações principais:**

- `@RestController` = `@Controller + @ResponseBody`. Tudo retorna JSON.
- `@RequestMapping("/v1/recurso")` no nível da classe — base path.
- `@GetMapping`, `@PostMapping`, `@PutMapping`, `@PatchMapping`, `@DeleteMapping`.
- `@PathVariable Long id` — captura `{id}` da URL.
- `@RequestParam` — query string `?nome=valor`.
- `@RequestBody` — deserializa o body em DTO.
- `@Valid` — dispara Bean Validation no DTO antes de chamar o método.
- `ResponseEntity<T>` — controle fino sobre status, headers, body.

**Verbos HTTP — semântica:**

| Verbo | Idempotente? | Uso |
|---|---|---|
| GET | Sim | Leitura, nunca muda estado |
| POST | Não | Criação |
| PUT | Sim | Substituição completa |
| PATCH | Sim* | Atualização parcial |
| DELETE | Sim | Remoção |

**Versionamento de API:** preferimos `/v1/...` no path. Outras formas: header (`Accept: application/vnd.clinica.v1+json`), query (`?version=1`).

---

## 4. Spring Data JPA + Hibernate

**Camadas:**

- **JPA:** spec.
- **Hibernate:** implementação default no Spring Boot.
- **Spring Data JPA:** abstração que gera queries automaticamente a partir do nome do método.

**Anotações JPA:**

```java
@Entity                      // marca classe como entidade gerenciada
@Table(name = "pacientes",
       indexes = @Index(...),
       uniqueConstraints = @UniqueConstraint(...))
public class PacienteEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "nome", nullable = false, length = 150)
    private String nome;

    @Enumerated(EnumType.STRING)   // SEMPRE string, nunca ORDINAL
    private Status status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "convenio_id")
    private ConvenioEntity convenio;

    @PrePersist void onCreate() { createdAt = LocalDateTime.now(); }
    @PreUpdate  void onUpdate() { updatedAt = LocalDateTime.now(); }
}
```

**Por que `LAZY` + `@EnumType.STRING`?**

- `LAZY`: não carrega o relacionamento até alguém chamar o getter. Evita N+1 e queries pesadas.
- `EnumType.STRING`: salva `"AGENDADO"` no banco. Se for `ORDINAL` (default antigo), salva 0/1/2 e qualquer reordenação do enum corrompe o banco.

**Spring Data Repository:**

```java
public interface PacienteRepository extends JpaRepository<PacienteEntity, Long> {
    // Query Derivation — gera SQL pelo nome
    Optional<PacienteEntity> findByEmail(String email);
    boolean existsByCpf(String cpf);
    List<PacienteEntity> findByConvenioId(Long convenioId);

    // JPQL custom
    @Query("SELECT p FROM PacienteEntity p LEFT JOIN FETCH p.convenio WHERE p.id = :id")
    Optional<PacienteEntity> findByIdWithConvenio(@Param("id") Long id);
}
```

**`@Transactional`:**

- No service, no método público.
- `@Transactional(readOnly = true)` em queries — desativa dirty checking, ganha performance.
- Em escrita, sem o `readOnly`. Se lançar `RuntimeException`, faz rollback automático.

**`ddl-auto`:**

- `none`: nada.
- `validate`: valida que schema bate com entidades, falha se não bater. Para produção.
- `update`: atualiza incrementalmente. Aceitável em dev.
- `create-drop`: cria no boot, derruba no shutdown. Usar em testes.

**Alternativas:** jOOQ (SQL type-safe), MyBatis (queries XML), Spring JDBC Template (cru), R2DBC (reativo).

---

## 5. MySQL 8

**Configuração JDBC:**

```
jdbc:mysql://host:porta/banco?createDatabaseIfNotExist=true
                              &useSSL=false
                              &allowPublicKeyRetrieval=true
                              &serverTimezone=America/Sao_Paulo
```

- `createDatabaseIfNotExist`: cria o banco se não existir. Ótimo em dev.
- `useSSL=false`: dev local. **Não usar em produção.**
- `allowPublicKeyRetrieval=true`: permite o driver baixar a chave do servidor. Necessário com `mysql_native_password` em alguns setups.
- `serverTimezone`: evita warning de timezone implícito.

**Database-per-service:** cada microsserviço com seu MySQL ou seu schema. Vantagens: isolamento, evolução independente, escalabilidade. Desvantagens: sem JOIN cruzado, integridade só em aplicação.

**Alternativas:** PostgreSQL (mais SQL features), MariaDB (fork compatível), H2 (em memória, dev/teste).

---

## 6. Lombok

**Papel:** processador de anotações que gera código boilerplate em compile-time.

| Anotação | Gera |
|---|---|
| `@Data` | `@Getter + @Setter + @ToString + @EqualsAndHashCode + @RequiredArgsConstructor` |
| `@Getter / @Setter` | só getters/setters |
| `@NoArgsConstructor` | construtor vazio (necessário p/ JPA) |
| `@AllArgsConstructor` | construtor com todos os campos |
| `@Builder` | builder pattern (`Foo.builder().nome("x").build()`) |
| `@RequiredArgsConstructor` | construtor com campos `final` (ideal p/ injeção) |
| `@Slf4j` | adiciona `private static final Logger log = ...` |

**Pegadinhas:**

- `@Data` em entidade JPA com `@ManyToOne` pode causar `StackOverflowError` no `toString()`/`equals()`. Use `@Data(callSuper = false)` + `@ToString(exclude = "convenio")` ou só `@Getter @Setter`.
- O IDE precisa do plugin Lombok (IntelliJ tem nativo desde 2020).

---

## 7. Bean Validation

**Spec Jakarta** (antes javax). Anotações em DTOs / entidades, ativadas com `@Valid` no método do controller.

| Anotação | Verifica |
|---|---|
| `@NotNull` | não-nulo |
| `@NotBlank` | não-nulo + não-vazio + não-só-espaços (apenas String) |
| `@NotEmpty` | não-nulo + não-vazio (Coleção/String) |
| `@Size(min, max)` | tamanho de String/Coleção |
| `@Min, @Max` | números |
| `@Email` | formato de e-mail |
| `@Pattern(regexp = "...")` | regex |
| `@Past, @Future` | data |
| `@Positive, @Negative` | números |
| `@Valid` (em campo) | valida em cascata |

**Como funciona:** quando o controller recebe `@Valid @RequestBody PacienteRequest req`, o Spring chama o validator antes do método. Se falhar, lança `MethodArgumentNotValidException` — o `GlobalExceptionHandler` traduz em 400 com lista de erros.

---

## 8. ModelMapper

**Papel:** copiar dados entre objetos (Entity ↔ DTO) por convenção de nome.

```java
ModelMapper m = new ModelMapper();
m.getConfiguration().setMatchingStrategy(MatchingStrategies.STRICT);

PacienteResponse dto = m.map(entity, PacienteResponse.class);
PacienteEntity   ent = m.map(request, PacienteEntity.class);
```

**Estratégias:**

- `STANDARD`: tolera diferenças. Pode mapear errado em casos ambíguos.
- `STRICT` (recomendado): só mapeia quando os nomes coincidem exatamente.
- `LOOSE`: agressiva, perigosa.

**Customização:**

```java
m.typeMap(PacienteEntity.class, PacienteResponse.class)
 .addMapping(src -> src.getConvenio().getNome(), PacienteResponse::setConvenioNome);
```

**Alternativas:** MapStruct (gera código em compile-time, mais rápido e seguro), conversão manual (sempre uma opção, sem mágica).

---

## 9. Spring Cloud OpenFeign

**Papel:** cliente HTTP **declarativo**. Você escreve uma interface; o Spring gera o proxy.

```java
@FeignClient(name = "administrativo",
             url  = "${administrativo.url}",
             configuration = FeignConfig.class)
public interface AdministrativoClient {
    @GetMapping("/v1/pacientes/{id}/exists")
    ExistsResponse pacienteExiste(@PathVariable Long id);
}
```

**Habilitar:** `@EnableFeignClients(basePackages = "...")` na classe `@SpringBootApplication`.

**`FeignConfig` com `ErrorDecoder`:**

```java
@Bean
public ErrorDecoder errorDecoder() {
    return (methodKey, response) -> switch (response.status()) {
        case 404 -> new EntityNotFoundException(...);
        case 502, 503 -> new FeignIntegrationException(...);
        default -> new FeignIntegrationException(...);
    };
}
```

**Outras configurações úteis:**

- `feign.client.config.default.connectTimeout=5000` — timeout de conexão (ms).
- `feign.client.config.default.readTimeout=10000` — timeout de leitura.
- Retry com `Retryer` bean.

**Alternativas:** `RestTemplate` (legado, blocking, manual), `WebClient` (reativo, fluente, recomendado em WebFlux).

---

## 10. Spring Cloud Gateway

**Stack:** WebFlux (Netty + Project Reactor), reativo. Não confunda com Zuul (legado, MVC).

**Configuração 100% via YAML:**

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: admin
          uri: http://administrativo:8081
          predicates:
            - Path=/api/admin/**
            - Method=GET,POST,PUT,DELETE
            - Header=X-Tenant, .*
          filters:
            - StripPrefix=2
            - AddRequestHeader=X-Source, gateway
            - AddResponseHeader=X-Powered-By, clinica-gateway
```

**Filtros built-in mais usados:**

- `StripPrefix=N` — remove os primeiros N segmentos do path.
- `RewritePath=regex, replacement` — reescreve o path.
- `AddRequestHeader / AddResponseHeader`
- `Retry` — retry de requisições falhas.
- `CircuitBreaker` (com Resilience4j) — fallback se backend cair.
- `RequestRateLimiter` (com Redis) — rate limit.

**Filtros customizados:** implementar `WebFilter` (Spring) ou `GlobalFilter` (Gateway). É reativo: retorna `Mono<Void>`.

---

## 11. Spring Security + JJWT

**Spring Security:**

- Servlet-based (Spring MVC) → `SecurityFilterChain` + `OncePerRequestFilter`.
- Reativo (WebFlux) → `SecurityWebFilterChain` + `WebFilter`.

**Componentes-chave:**

- `SecurityContextHolder` (servlet) / `ReactiveSecurityContextHolder` (reativo) — guarda o usuário autenticado.
- `Authentication` — representa o "quem". Atributos: principal (usuário), credentials (senha/null), authorities (roles).
- `AuthenticationManager` — autentica.
- `UserDetailsService` — busca usuário (não usamos quando temos JWT auto-contido).
- `PasswordEncoder` — `BCryptPasswordEncoder` é o padrão.

**`@PreAuthorize` / `@PostAuthorize`:** SpEL para autorização por método. Habilitar com `@EnableMethodSecurity`.

```java
@PreAuthorize("hasRole('ADMIN')")
@PreAuthorize("hasAnyRole('ADMIN','RECEPCIONISTA')")
@PreAuthorize("hasRole('PACIENTE') and #pacienteId == authentication.principal.id")
```

**JJWT (`io.jsonwebtoken:jjwt-api`):**

- `Jwts.builder()` para emitir.
- `Jwts.parser().verifyWith(key).build().parseSignedClaims(token)` para validar.
- Algoritmo: HMAC SHA-256 (`HS256`) com chave simétrica de **mínimo 256 bits** (32 bytes).

---

## 12. SpringDoc OpenAPI (Swagger)

**Dep:** `org.springdoc:springdoc-openapi-starter-webmvc-ui:2.6.0`.

**Endpoints expostos automaticamente:**

- `/v3/api-docs` — JSON da especificação OpenAPI.
- `/swagger-ui.html` — interface interativa.

**Anotações úteis:**

- `@Tag(name = "Convênio", description = "...")` no controller.
- `@Operation(summary = "...", description = "...")` no método.
- `@Parameter(description = "...")` em parâmetros.
- `@ApiResponse(responseCode = "200", description = "...")`
- `@Schema(description = "...", example = "...")` em campos de DTO.

**Configuração:**

```yaml
springdoc:
  swagger-ui:
    path: /swagger-ui.html
    operations-sorter: method
    tags-sorter: alpha
  api-docs:
    path: /v3/api-docs
```

**Auth no Swagger:** adicionar `@SecurityScheme` num `@Configuration` para habilitar o botão "Authorize":

```java
@Configuration
@SecurityScheme(name = "bearer-key", type = SecuritySchemeType.HTTP, scheme = "bearer", bearerFormat = "JWT")
@OpenAPIDefinition(info = @Info(title = "Administrativo API", version = "1.0"),
                   security = @SecurityRequirement(name = "bearer-key"))
public class SwaggerConfig {}
```

---

## 13. Logbook

**Papel:** logging estruturado de requisições/respostas HTTP. Captura body, headers, tempo.

**Dep:** `org.zalando:logbook-spring-boot-starter:3.9.0`.

**Saída exemplo:**

```
Incoming Request: f8c3...
POST http://localhost:8081/v1/convenios HTTP/1.1
Content-Type: application/json
{"nome":"Unimed","descricao":"Premium"}

Outgoing Response: f8c3... (47ms)
HTTP/1.1 201 Created
Content-Type: application/json
{"success":true,"data":{"id":1,"nome":"Unimed"}}
```

**Configuração:**

```yaml
logbook:
  format:
    style: http             # http (default) ou json ou curl
  predicate:
    exclude:
      - path: /actuator/**
      - path: /swagger-ui/**

logging:
  level:
    org.zalando.logbook: TRACE
```

**Por que `TRACE`?** Em INFO/DEBUG, Logbook não loga. Por design — protege produção de logar tudo.

**Obfuscação de campos sensíveis:** customizável via `BodyFilter`. Ver docs.

---

## 14. Jackson

**Papel:** serialização/desserialização JSON. Vem embutido no `spring-boot-starter-web`.

**Anotações úteis:**

- `@JsonInclude(NON_NULL)` — omite campos `null` no JSON.
- `@JsonProperty("nome_externo")` — renomeia.
- `@JsonIgnore` — ignora o campo.
- `@JsonFormat(pattern = "yyyy-MM-dd")` — formato de data.

**Configuração global:**

```yaml
spring:
  jackson:
    serialization:
      write-dates-as-timestamps: false
    default-property-inclusion: non_null
    date-format: yyyy-MM-dd'T'HH:mm:ss
```

**Java 21 records** funcionam direto, sem precisar de getters.

---

## 15. JUnit 5 + Mockito + AssertJ

**JUnit 5 (Jupiter):** runner padrão.

- `@Test` — método de teste.
- `@BeforeEach`, `@AfterEach` — antes/depois de cada teste.
- `@BeforeAll`, `@AfterAll` — antes/depois da classe (precisam ser `static`).
- `@Tag("integration")` — agrupa testes.
- `@Nested` — classes aninhadas para organização.
- `@ParameterizedTest` + `@ValueSource` — testes parametrizados.

**Mockito:**

- `@Mock` — cria mock.
- `@InjectMocks` — injeta mocks no SUT (subject under test).
- `@Spy` — wrappear objeto real, mockando métodos seletos.
- `when(mock.method()).thenReturn(...)`.
- `verify(mock).method()` — confere chamada.
- `verify(mock, times(2))`, `verify(mock, never())`.
- `ArgumentCaptor` — captura argumentos passados.

**AssertJ** (mais fluente que asserções nativas):

```java
assertThat(result).isNotNull();
assertThat(list).hasSize(3).containsExactly(a, b, c);
assertThat(map).containsEntry("nome", "João");
assertThatThrownBy(() -> svc.delete(99)).isInstanceOf(EntityNotFoundException.class);
```

---

## 16. Testcontainers

**Papel:** sobe containers Docker (MySQL, Kafka, etc.) durante os testes. Fim do "funciona com H2 mas quebra em produção".

**Setup:**

```java
@Testcontainers
class MyTest {
    @Container
    static MySQLContainer<?> mysql = new MySQLContainer<>("mysql:8")
        .withReuse(true);

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", mysql::getJdbcUrl);
        r.add("spring.datasource.username", mysql::getUsername);
        r.add("spring.datasource.password", mysql::getPassword);
    }
}
```

**Reuse:** crie `~/.testcontainers.properties` com `testcontainers.reuse.enable=true` e use `.withReuse(true)`. O container fica de pé entre execuções, acelerando muito.

**Outros containers:** `KafkaContainer`, `MongoDBContainer`, `LocalStackContainer` (AWS), `GenericContainer` (qualquer imagem).

---

## 17. Docker

**Conceitos básicos:**

- **Imagem:** snapshot read-only de um sistema. Versionada por tag.
- **Container:** processo rodando uma imagem. Stateless por padrão.
- **Volume:** disco persistente fora do container.
- **Network:** rede virtual onde containers se comunicam por nome (`http://administrativo:8081` em vez de IP).

**Dockerfile multi-stage:** `FROM ... AS build` separado de `FROM ... AS runtime`. Stage final só leva o necessário, imagem fica menor.

**Variáveis de ambiente:** definidas no `Dockerfile` (`ENV`), no `docker run -e` ou no compose `environment:`. Cascata: container > compose > Dockerfile > defaults da app.

**Comandos:**

```bash
docker build -t nome:tag .
docker run -d -p 8081:8081 --name foo nome:tag
docker logs -f foo
docker exec -it foo sh
docker ps
docker images
docker volume ls
docker network ls
```

---

## 18. GitHub Actions

**Conceitos:**

- **Workflow:** arquivo YAML em `.github/workflows/`.
- **Job:** unidade de execução em um runner (VM).
- **Step:** comando ou action dentro de um job.
- **Action:** componente reutilizável (ex: `actions/checkout`, `actions/setup-java`).
- **Runner:** VM Ubuntu/macOS/Windows; gratuito para repos públicos.
- **Matrix strategy:** roda o mesmo job para várias combinações (ex: 4 serviços).
- **Secrets:** variáveis privadas, configuradas em `Settings → Secrets`.

**Permissões:** `permissions:` no topo do workflow restringe o que `GITHUB_TOKEN` pode fazer.

---

## 19. Tipos Java fundamentais

**`Optional<T>`** — evita `NullPointerException`. Use no retorno de queries. `findById(id)` retorna `Optional<Foo>`. `.orElseThrow(...)` para extrair ou lançar.

**Stream API:**

```java
list.stream()
    .filter(p -> p.getAtivo())
    .map(p -> p.getNome())
    .sorted()
    .toList();   // Java 16+
```

**`LocalDate`, `LocalDateTime`** (java.time) — não use `Date` legado.

**`BigDecimal`** para dinheiro. Nunca `double`/`float`. Compare com `compareTo`, não `equals` (escala importa).

**Records (Java 16+):**

```java
public record LoginRequest(String email, String senha) {}
```

Imutável, com `equals/hashCode/toString` automático. Ideal para DTOs simples.

**Enums com `@Enumerated(STRING)`:** sempre. Enum no banco como nome, não ordinal.

---

## 20. Spring Auto-configuration

**Como o commons compartilha o `GlobalExceptionHandler` automaticamente:**

1. Em `commons`, anota `CommonsAutoConfiguration` com `@AutoConfiguration`.
2. Lista a classe em `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`.
3. Quando um serviço (que depende do commons) sobe, Spring Boot lê esse arquivo e instancia a classe automaticamente — sem `@ComponentScan` apontando para o pacote.

**Substitui o antigo `META-INF/spring.factories`** (Spring Boot 2.x).

**Ordem de carregamento:** Spring Boot carrega seu código primeiro, depois auto-configurations. Use `@ConditionalOnMissingBean` para permitir que o consumidor sobreponha. Use `@ConditionalOnClass` para só ativar se uma classe estiver no classpath.

---

## Mapa rápido: tecnologia ↔ arquivo

| Tecnologia | Onde aparece |
|---|---|
| Maven multi-módulo | `pom.xml` (raiz e cada módulo) |
| Spring Boot | `*Application.java`, `application.yml` |
| Spring MVC | `*Controller.java` |
| JPA / Hibernate | `*Entity.java`, `*Repository.java` |
| MySQL | `application.yml` (datasource), `docker-compose.yml` |
| Lombok | qualquer classe com `@Data`, `@Builder`, etc. |
| Bean Validation | DTOs (`@NotBlank`, `@Email`...) |
| ModelMapper | `*Service.java` |
| OpenFeign | `client/*Client.java`, `client/FeignConfig.java` |
| Spring Cloud Gateway | `gateway/application.yml` |
| Spring Security + JJWT | `security/*Filter.java`, `auth/JwtService.java` |
| SpringDoc | `application.yml` (springdoc.*), `@Tag`, `@Operation` |
| Logbook | `application.yml` (logbook.*) |
| Jackson | `ApiResponse` (`@JsonInclude`), `application.yml` (spring.jackson) |
| JUnit + Mockito | `*Test.java` |
| Testcontainers | `support/AbstractIntegrationTest.java` |
| Docker | `Dockerfile`, `.dockerignore`, `docker-compose.yml` |
| GitHub Actions | `.github/workflows/*.yml` |
| Auto-config | `commons/META-INF/spring/...AutoConfiguration.imports` |

---

## Glossário rápido

| Termo | Significado |
|---|---|
| **BOM** | Bill of Materials. POM importado para gerenciar versões. |
| **DTO** | Data Transfer Object. Objeto trafegado entre camadas/serviços. |
| **Entity** | Classe mapeada para tabela no banco. |
| **CRUD** | Create, Read, Update, Delete. |
| **REST** | Representational State Transfer. Estilo arquitetural HTTP. |
| **JWT** | JSON Web Token. Token stateless assinado. |
| **HMAC** | Hash-based Message Authentication Code. Algoritmo simétrico. |
| **SPI** | Service Provider Interface. Mecanismo de descoberta no Java/Spring. |
| **N+1** | Problema de múltiplas queries em loop por relacionamento lazy. |
| **CSRF** | Cross-Site Request Forgery. Não se aplica em APIs stateless. |
| **CORS** | Cross-Origin Resource Sharing. Permite frontend chamar API de outro domínio. |
| **AAA** | Arrange, Act, Assert — padrão de teste. |
| **SUT** | System Under Test — o código sendo testado. |

---

Fim da referência. Volte aos docs específicos para implementação.
