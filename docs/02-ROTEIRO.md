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
java -version        # deve mostrar Java 21.x.x
mvn -version         # deve mostrar Maven 3.9.x
docker --version     # deve mostrar Docker 24+
docker compose version  # deve mostrar Compose 2.x
```

No IntelliJ: confirme que o SDK do projeto está configurado para Java 21 em `File → Project Structure → SDK`.

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

> **Atenção:** o `administrativo` já tem `spring-boot-starter-security` no `pom.xml`.
> A partir do PASSO 2 o Spring Security está ativo e bloqueia POST/PUT/DELETE por CSRF.
> Estes comandos só funcionam depois que o `SecurityConfig` do PASSO 3 for criado.

```bash
PASS="senha-gerada-no-log"   # substitua pela senha que aparece no console ao subir

# Listar convênios
curl -s -u user:$PASS http://localhost:8081/v1/convenios | jq .

# Criar um convênio de teste
curl -s -u user:$PASS -X POST http://localhost:8081/v1/convenios \
  -H "Content-Type: application/json" \
  -d '{"nome":"Unimed Teste","descricao":"Plano Básico"}' | jq .
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

**3. Registrar a auto-configuration (SPI do Spring Boot 3+/4.x)**

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
    <version>2025.1.2</version>
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
<spring-cloud.version>2025.1.2</spring-cloud.version>
<testcontainers.version>1.20.4</testcontainers.version>
```

**2. Atualizar o `administrativo/pom.xml` — adicionar dependências**

Adicione ao `administrativo/pom.xml` (que já tem web, JPA, MySQL, commons, lombok, validation):

```xml
<!-- Swagger/OpenAPI -->
<dependency>
    <groupId>org.springdoc</groupId>
    <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
    <version>3.0.3</version>
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
    <version>4.0.4</version>
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

> Implementar o CRUD de Convênio com o padrão correto: entidade no `administrativo`,
> service sem lógica de apresentação, controller wrappando com `ApiResponse<T>`.
> Este é o template que você vai repetir para Médico e Paciente.

**Depende de:** PASSO 2 concluído (administrativo sobe com Spring Security gerando senha temporária).

### Regra de ouro do padrão em 3 camadas

Antes de escrever código, grave esta regra:

```
Controller  →  converte Request → Entity (via ModelMapper), chama Service, converte Entity → Response
Service     →  recebe Entity, persiste, lança exceção se não encontrar. NUNCA usa DTO/Response.
Repository  →  interface JPA. Nada mais.
```

**Erros comuns que vão acontecer se você ignorar isso:**
- Injetar `ModelMapper` no Service → não compila (ModelMapper não está no Service, está no Controller)
- Retornar `ConvenioResponse` do Service → o `update` vai tentar fazer `.save(response)` no repository e falhar
- Chamar `ApiResponse.success("mensagem", data)` → não existe essa assinatura; é `ApiResponse.success(data)` apenas

---

### Estrutura de arquivos

Crie a seguinte estrutura de pacotes (organize por feature, não por camada):

```
administrativo/src/main/java/br/edu/imepac/administrativo/
└── convenio/
    ├── ConvenioEntity.java      ← entidade JPA
    ├── ConvenioRepository.java  ← interface Spring Data
    ├── ConvenioService.java     ← regras de negócio
    ├── ConvenioController.java  ← endpoints REST
    └── dto/
        ├── ConvenioRequest.java   ← dados que chegam do cliente
        └── ConvenioResponse.java  ← dados que saem para o cliente
```

---

### Arquivo 1 — `ConvenioEntity.java`

```java
package br.edu.imepac.administrativo.convenio;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "convenios")
public class ConvenioEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "O nome do convênio é obrigatório")
    @Column(nullable = false, unique = true, length = 150)
    private String nome;

    @Column(length = 500)
    private String descricao;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() { createdAt = updatedAt = LocalDateTime.now(); }

    @PreUpdate
    void onUpdate() { updatedAt = LocalDateTime.now(); }
}
```

> **Por que `@Builder`?** Permite criar instâncias nos testes passando só os campos necessários:
> `ConvenioEntity.builder().id(1L).nome("Unimed").build()` — sem precisar passar `createdAt` e `updatedAt`.
> Sem `@Builder`, o `@AllArgsConstructor` gera um construtor com 5 parâmetros e o teste quebra.

---

### Arquivo 2 — `ConvenioRepository.java`

```java
package br.edu.imepac.administrativo.convenio;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ConvenioRepository extends JpaRepository<ConvenioEntity, Long> {
}
```

> Não adicione `@Repository` — o Spring Data detecta interfaces que estendem `JpaRepository` automaticamente.

---

### Arquivo 3 — `ConvenioService.java`

```java
package br.edu.imepac.administrativo.convenio;

import br.edu.imepac.commons.exceptions.EntityNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ConvenioService {

    private final ConvenioRepository convenioRepository;

    public ConvenioService(ConvenioRepository convenioRepository) {
        this.convenioRepository = convenioRepository;
    }

    public List<ConvenioEntity> findAll() {
        return convenioRepository.findAll();
    }

    public ConvenioEntity findById(Long id) {
        return convenioRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Convênio não encontrado com id: " + id));
    }

    public ConvenioEntity save(ConvenioEntity convenio) {
        return convenioRepository.save(convenio);
    }

    public ConvenioEntity update(Long id, ConvenioEntity dadosAtualizados) {
        ConvenioEntity existing = findById(id);   // lança 404 se não existir
        existing.setNome(dadosAtualizados.getNome());
        existing.setDescricao(dadosAtualizados.getDescricao());
        return convenioRepository.save(existing);
    }

    public void deleteById(Long id) {
        if (!convenioRepository.existsById(id)) {
            throw new EntityNotFoundException("Convênio não encontrado com id: " + id);
        }
        convenioRepository.deleteById(id);
    }
}
```

> **Atenção:** O service não conhece `ModelMapper`, não importa `ConvenioResponse`, não tem `@Autowired`.
> Toda conversão Entity ↔ DTO acontece no Controller.

---

### Arquivo 4 — `dto/ConvenioRequest.java`

```java
package br.edu.imepac.administrativo.convenio.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ConvenioRequest {

    @NotBlank(message = "O nome do convênio é obrigatório")
    private String nome;

    private String descricao;
}
```

---

### Arquivo 5 — `dto/ConvenioResponse.java`

```java
package br.edu.imepac.administrativo.convenio.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ConvenioResponse {

    private Long id;
    private String nome;
    private String descricao;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
```

---

### Arquivo 6 — `ConvenioController.java`

```java
package br.edu.imepac.administrativo.convenio;

import br.edu.imepac.administrativo.convenio.dto.ConvenioRequest;
import br.edu.imepac.administrativo.convenio.dto.ConvenioResponse;
import br.edu.imepac.commons.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.modelmapper.ModelMapper;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Convênios", description = "CRUD de convênios médicos")
@RestController
@RequestMapping("/v1/convenios")
public class ConvenioController {

    private final ConvenioService convenioService;
    private final ModelMapper modelMapper;

    public ConvenioController(ConvenioService convenioService, ModelMapper modelMapper) {
        this.convenioService = convenioService;
        this.modelMapper = modelMapper;
    }

    @Operation(summary = "Listar todos os convênios")
    @GetMapping
    public ResponseEntity<ApiResponse<List<ConvenioResponse>>> findAll() {
        List<ConvenioResponse> list = convenioService.findAll()
                .stream()
                .map(entity -> modelMapper.map(entity, ConvenioResponse.class))
                .toList();
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @Operation(summary = "Buscar convênio por ID")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ConvenioResponse>> findById(@PathVariable Long id) {
        ConvenioResponse response = modelMapper.map(convenioService.findById(id), ConvenioResponse.class);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @Operation(summary = "Criar novo convênio")
    @PostMapping
    public ResponseEntity<ApiResponse<ConvenioResponse>> create(@Valid @RequestBody ConvenioRequest request) {
        ConvenioEntity entity = modelMapper.map(request, ConvenioEntity.class);
        ConvenioResponse response = modelMapper.map(convenioService.save(entity), ConvenioResponse.class);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    @Operation(summary = "Atualizar convênio")
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<ConvenioResponse>> update(@PathVariable Long id,
                                                               @Valid @RequestBody ConvenioRequest request) {
        ConvenioEntity entity = modelMapper.map(request, ConvenioEntity.class);
        ConvenioResponse response = modelMapper.map(convenioService.update(id, entity), ConvenioResponse.class);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @Operation(summary = "Excluir convênio")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        convenioService.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
```

> **`ModelMapper` não está declarado no `pom.xml` do `administrativo`?** Não precisa — ele vem do `commons`
> e é registrado automaticamente pelo `CommonsAutoConfiguration` via SPI. O Spring injeta no construtor.

> **Warning do IntelliJ "has private attribute in ApiResponse"?** É um falso positivo.
> O IntelliJ não processa as anotações Lombok durante análise estática. Em tempo de compilação e execução
> o Lombok gera os getters públicos que o Jackson usa. O código compila e funciona corretamente.

---

### Arquivo 5 — `config/SecurityConfig.java` (temporário, sem JWT)

> **Por que criar agora?** O `spring-boot-starter-security` já está no `pom.xml` desde o PASSO 2.
> Sem nenhuma configuração, o Spring Security bloqueia POST/PUT/DELETE via CSRF — qualquer `curl` de escrita
> retorna 403 ou 401 silencioso. Este `SecurityConfig` desabilita CSRF e usa HTTP Basic stateless para
> desenvolvimento. Ele será **inteiramente substituído** pela versão com JWT no PASSO 7.
>
> **Armadilha: não adicione `PasswordEncoder` aqui.** O Spring gera uma senha temporária em plain text
> (`Using generated security password: uuid...`). Se você registrar um `BCryptPasswordEncoder` como bean,
> o Spring Security vai tentar verificar esse UUID como hash BCrypt e a autenticação vai falhar
> silenciosamente — o `curl` retorna vazio sem mensagem de erro. O `PasswordEncoder` só entra no PASSO 7,
> junto com o `UserDetailsService` que já armazena as senhas pré-hasheadas.

```java
// administrativo/src/main/java/br/edu/imepac/administrativo/config/SecurityConfig.java
package br.edu.imepac.administrativo.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

import static org.springframework.security.config.Customizer.withDefaults;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                "/swagger-ui/**",
                                "/swagger-ui.html",
                                "/v3/api-docs/**",
                                "/actuator/**"
                        ).permitAll()
                        .anyRequest().authenticated()
                )
                .httpBasic(withDefaults())
                .build();
    }
    // PasswordEncoder será adicionado no PASSO 7 junto com JwtAuthFilter e UserDetailsService
}
```

---

### Validação

Suba o serviço e teste cada cenário na sequência:

```bash
# Subir o administrativo
mvn spring-boot:run -pl administrativo
```

O console vai mostrar a senha temporária do Spring Security — **guarde para usar nos testes**:
```
Using generated security password: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

```bash
# Criar convênio (use -u para autenticar com a senha gerada acima)
curl -s -u user:SENHA_GERADA -X POST http://localhost:8081/v1/convenios \
  -H "Content-Type: application/json" \
  -d '{"nome":"Unimed","descricao":"Plano Premium"}' | jq .
```

Saída esperada (`201 Created`):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "nome": "Unimed",
    "descricao": "Plano Premium",
    "createdAt": "2026-05-12T10:00:00",
    "updatedAt": "2026-05-12T10:00:00"
  }
}
```

```bash
# Listar todos
curl -s -u user:SENHA_GERADA http://localhost:8081/v1/convenios | jq .

# Buscar por ID válido
curl -s -u user:SENHA_GERADA http://localhost:8081/v1/convenios/1 | jq .

# Buscar por ID inválido — GlobalExceptionHandler retorna 404
curl -s -u user:SENHA_GERADA http://localhost:8081/v1/convenios/999 | jq .
```

Saída esperada para o 404:
```json
{
  "success": false,
  "message": "Convênio não encontrado com id: 999"
}
```

```bash
# Criar com nome em branco — Bean Validation retorna 400
curl -s -u user:SENHA_GERADA -X POST http://localhost:8081/v1/convenios \
  -H "Content-Type: application/json" \
  -d '{"descricao":"sem nome"}' | jq .
```

Saída esperada para o 400:
```json
{
  "success": false,
  "message": "Erro de validação",
  "errors": ["O nome do convênio é obrigatório"]
}
```

```bash
# Atualizar
curl -s -u user:SENHA_GERADA -X PUT http://localhost:8081/v1/convenios/1 \
  -H "Content-Type: application/json" \
  -d '{"nome":"Unimed Nacional","descricao":"Cobertura nacional"}' | jq .

# Excluir
curl -s -u user:SENHA_GERADA -X DELETE http://localhost:8081/v1/convenios/1
# → HTTP 204 (sem corpo)
```

**Verificar banco de dados:**
```bash
docker compose exec mysql mysql -uroot clinica_administrativo \
  -e "SELECT id, nome, created_at, updated_at FROM convenios;"
```

**Swagger UI:** acesse `http://localhost:8081/swagger-ui.html` — vai pedir login (user/SENHA_GERADA).
Os endpoints de Convênio devem aparecer agrupados sob a tag "Convênios".

### Ponto de controle — avance somente quando:

- [ ] `POST /v1/convenios` retorna `201 Created` com `{"success":true,"data":{...}}`
- [ ] `GET /v1/convenios/{id}` com id inválido retorna `404` com `{"success":false,"message":"..."}`
- [ ] `POST` com nome em branco retorna `400` com lista `errors`
- [ ] `PUT /v1/convenios/{id}` com id inválido retorna `404` (não `500`)
- [ ] Tabela `convenios` no banco tem colunas `created_at` e `updated_at` preenchidas
- [ ] Swagger UI mostra os 5 endpoints agrupados em "Convênios"
- [ ] `mvn test -pl administrativo` → 8 testes passando

---

## PASSO 4 — Médico [45 min]

> Médico não tem FK para outras tabelas — é a entidade mais simples depois de Convênio.
> O detalhe importante aqui é o endpoint `GET /v1/medicos/{id}/exists`, que o serviço
> `agendamento` vai chamar via Feign para validar se o médico existe antes de criar um agendamento.

**Depende de:** PASSO 3 concluído.

### Estrutura de arquivos

```
administrativo/src/main/java/br/edu/imepac/administrativo/
├── medico/
│   ├── MedicoEntity.java
│   ├── MedicoRepository.java
│   ├── MedicoService.java
│   ├── MedicoController.java
│   └── dto/
│       ├── MedicoRequest.java
│       └── MedicoResponse.java
└── shared/
    └── dto/
        └── ExistsResponse.java   ← usado por Médico e Paciente
```

---

### Arquivo 1 — `shared/dto/ExistsResponse.java`

> Crie esta classe primeiro, pois tanto `MedicoController` quanto `PacienteController` vão usá-la.

```java
package br.edu.imepac.administrativo.shared.dto;

public record ExistsResponse(boolean exists) {}
```

> **`record`** é um recurso do Java 16+. Gera automaticamente construtor, getters, `equals`, `hashCode` e `toString`.
> Ideal para DTOs simples de somente leitura — muito menos código que uma classe com `@Data`.

---

### Arquivo 2 — `medico/MedicoEntity.java`

```java
package br.edu.imepac.administrativo.medico;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "medicos", uniqueConstraints = {
        @UniqueConstraint(columnNames = "email"),
        @UniqueConstraint(columnNames = "crm")
})
public class MedicoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "O nome é obrigatório")
    @Size(max = 150)
    @Column(nullable = false, length = 150)
    private String nome;

    @NotBlank(message = "O e-mail é obrigatório")
    @Email(message = "E-mail inválido")
    @Column(nullable = false, length = 200)
    private String email;

    @NotBlank(message = "O CRM é obrigatório")
    @Size(max = 20)
    @Column(nullable = false, length = 20)
    private String crm;

    @NotBlank(message = "A especialidade é obrigatória")
    @Size(max = 100)
    @Column(nullable = false, length = 100)
    private String especialidade;

    @Size(max = 20)
    @Column(length = 20)
    private String telefone;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() { createdAt = updatedAt = LocalDateTime.now(); }

    @PreUpdate
    void onUpdate() { updatedAt = LocalDateTime.now(); }
}
```

---

### Arquivo 3 — `medico/MedicoRepository.java`

```java
package br.edu.imepac.administrativo.medico;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MedicoRepository extends JpaRepository<MedicoEntity, Long> {

    boolean existsByEmail(String email);

    boolean existsByCrm(String crm);
}
```

> Esses dois métodos são usados no `MedicoService` para detectar duplicatas antes de salvar.
> O Spring Data cria a query automaticamente a partir do nome do método — não precisa de `@Query`.

---

### Arquivo 4 — `medico/MedicoService.java`

```java
package br.edu.imepac.administrativo.medico;

import br.edu.imepac.commons.exceptions.BusinessException;
import br.edu.imepac.commons.exceptions.EntityNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class MedicoService {

    private final MedicoRepository medicoRepository;

    public MedicoService(MedicoRepository medicoRepository) {
        this.medicoRepository = medicoRepository;
    }

    public List<MedicoEntity> findAll() {
        return medicoRepository.findAll();
    }

    public MedicoEntity findById(Long id) {
        return medicoRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Médico não encontrado com id: " + id));
    }

    public boolean existsById(Long id) {
        return medicoRepository.existsById(id);
    }

    public MedicoEntity save(MedicoEntity medico) {
        if (medicoRepository.existsByEmail(medico.getEmail()))
            throw new BusinessException("E-mail já cadastrado");
        if (medicoRepository.existsByCrm(medico.getCrm()))
            throw new BusinessException("CRM já cadastrado");
        return medicoRepository.save(medico);
    }

    public MedicoEntity update(Long id, MedicoEntity dadosAtualizados) {
        MedicoEntity existing = findById(id);
        existing.setNome(dadosAtualizados.getNome());
        existing.setEspecialidade(dadosAtualizados.getEspecialidade());
        existing.setTelefone(dadosAtualizados.getTelefone());
        return medicoRepository.save(existing);
    }

    public void deleteById(Long id) {
        if (!medicoRepository.existsById(id))
            throw new EntityNotFoundException("Médico não encontrado com id: " + id);
        medicoRepository.deleteById(id);
    }
}
```

> **Regra aplicada:** o service lança `BusinessException` (HTTP 422) para violações de regra de negócio
> (duplicata de e-mail/CRM) e `EntityNotFoundException` (HTTP 404) para entidades não encontradas.
> O `GlobalExceptionHandler` do commons captura e converte para `ApiResponse`.

---

### Arquivo 5 — `medico/dto/MedicoRequest.java`

```java
package br.edu.imepac.administrativo.medico.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MedicoRequest {

    @NotBlank(message = "O nome é obrigatório")
    private String nome;

    @NotBlank(message = "O e-mail é obrigatório")
    @Email(message = "E-mail inválido")
    private String email;

    @NotBlank(message = "O CRM é obrigatório")
    private String crm;

    @NotBlank(message = "A especialidade é obrigatória")
    private String especialidade;

    private String telefone;
}
```

---

### Arquivo 6 — `medico/dto/MedicoResponse.java`

```java
package br.edu.imepac.administrativo.medico.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MedicoResponse {

    private Long id;
    private String nome;
    private String email;
    private String crm;
    private String especialidade;
    private String telefone;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
```

---

### Arquivo 7 — `medico/MedicoController.java`

```java
package br.edu.imepac.administrativo.medico;

import br.edu.imepac.administrativo.medico.dto.MedicoRequest;
import br.edu.imepac.administrativo.medico.dto.MedicoResponse;
import br.edu.imepac.administrativo.shared.dto.ExistsResponse;
import br.edu.imepac.commons.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.modelmapper.ModelMapper;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Médicos", description = "CRUD de médicos")
@RestController
@RequestMapping("/v1/medicos")
public class MedicoController {

    private final MedicoService medicoService;
    private final ModelMapper modelMapper;

    public MedicoController(MedicoService medicoService, ModelMapper modelMapper) {
        this.medicoService = medicoService;
        this.modelMapper = modelMapper;
    }

    @Operation(summary = "Listar todos os médicos")
    @GetMapping
    public ResponseEntity<ApiResponse<List<MedicoResponse>>> findAll() {
        List<MedicoResponse> list = medicoService.findAll()
                .stream()
                .map(entity -> modelMapper.map(entity, MedicoResponse.class))
                .toList();
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @Operation(summary = "Buscar médico por ID")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<MedicoResponse>> findById(@PathVariable Long id) {
        MedicoResponse response = modelMapper.map(medicoService.findById(id), MedicoResponse.class);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @Operation(summary = "Verificar se médico existe — endpoint interno para Feign")
    @GetMapping("/{id}/exists")
    public ResponseEntity<ExistsResponse> exists(@PathVariable Long id) {
        return ResponseEntity.ok(new ExistsResponse(medicoService.existsById(id)));
    }

    @Operation(summary = "Criar novo médico")
    @PostMapping
    public ResponseEntity<ApiResponse<MedicoResponse>> create(@Valid @RequestBody MedicoRequest request) {
        MedicoEntity entity = modelMapper.map(request, MedicoEntity.class);
        MedicoResponse response = modelMapper.map(medicoService.save(entity), MedicoResponse.class);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    @Operation(summary = "Atualizar médico")
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<MedicoResponse>> update(@PathVariable Long id,
                                                              @Valid @RequestBody MedicoRequest request) {
        MedicoEntity entity = modelMapper.map(request, MedicoEntity.class);
        MedicoResponse response = modelMapper.map(medicoService.update(id, entity), MedicoResponse.class);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @Operation(summary = "Excluir médico")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        medicoService.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
```

> **`/exists` não usa `ApiResponse`** — ele retorna `ExistsResponse` diretamente porque o `agendamento`
> vai fazer o parse deste JSON via Feign. Manter a estrutura simples facilita a deserialização.

---

### Validação

```bash
# Usar a senha gerada pelo Spring Security (visível no console ao subir o serviço)
# Substitua SENHA_GERADA abaixo
curl -s -u user:SENHA_GERADA -X POST http://localhost:8081/v1/medicos \
  -H "Content-Type: application/json" \
  -d '{"nome":"Dr. Paulo Silva","email":"paulo@clinica.com","crm":"CRM-MG-123456","especialidade":"Cardiologia","telefone":"31999990001"}' | jq .
```

Saída esperada (`201 Created`):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "nome": "Dr. Paulo Silva",
    "email": "paulo@clinica.com",
    "crm": "CRM-MG-123456",
    "especialidade": "Cardiologia",
    "telefone": "31999990001",
    "createdAt": "2026-05-12T10:00:00",
    "updatedAt": "2026-05-12T10:00:00"
  }
}
```

```bash
# /exists — retorna true para ID válido, false para inválido (sem autenticação — endpoint público após PASSO 7)
curl -s -u user:SENHA_GERADA http://localhost:8081/v1/medicos/1/exists | jq .
# → {"exists": true}

curl -s -u user:SENHA_GERADA http://localhost:8081/v1/medicos/999/exists | jq .
# → {"exists": false}

# CRM duplicado — deve retornar 422 (BusinessException → GlobalExceptionHandler)
curl -s -u user:SENHA_GERADA -X POST http://localhost:8081/v1/medicos \
  -H "Content-Type: application/json" \
  -d '{"nome":"Dr. Outro","email":"outro@clinica.com","crm":"CRM-MG-123456","especialidade":"Clínica Geral"}' | jq .
```

Saída esperada para o 422:
```json
{
  "success": false,
  "message": "CRM já cadastrado"
}
```

```bash
# Verificar banco
docker compose exec mysql mysql -uroot clinica_administrativo \
  -e "DESCRIBE medicos; SELECT id, nome, crm FROM medicos;"
```

### Ponto de controle — avance somente quando:

- [ ] `POST /v1/medicos` retorna `201` com objeto completo
- [ ] `GET /v1/medicos/{id}/exists` retorna `{"exists":true}` para ID válido
- [ ] `GET /v1/medicos/{id}/exists` retorna `{"exists":false}` para ID inválido (não 404)
- [ ] CRM duplicado retorna `422` com `"message":"CRM já cadastrado"`
- [ ] E-mail duplicado retorna `422` com `"message":"E-mail já cadastrado"`
- [ ] Tabela `medicos` criada com colunas `unique` em `email` e `crm`

---

## PASSO 5 — Paciente [1h30]

> Paciente é a entidade mais complexa do `administrativo`. Tem FK opcional para `convenios`
> (nem todo paciente tem plano de saúde), e o campo `convenioId` do request precisa ser
> resolvido para um `ConvenioEntity` antes de salvar — esta resolução é responsabilidade do Service.

**Depende de:** PASSO 4 concluído (tabela `convenios` já existe para a FK).

### Estrutura de arquivos

```
administrativo/src/main/java/br/edu/imepac/administrativo/paciente/
├── PacienteEntity.java
├── PacienteRepository.java
├── PacienteService.java
├── PacienteController.java
└── dto/
    ├── PacienteRequest.java
    └── PacienteResponse.java
```

---

### Arquivo 1 — `paciente/PacienteEntity.java`

```java
package br.edu.imepac.administrativo.paciente;

import br.edu.imepac.administrativo.convenio.ConvenioEntity;
import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "pacientes", uniqueConstraints = {
        @UniqueConstraint(columnNames = "email"),
        @UniqueConstraint(columnNames = "cpf")
})
public class PacienteEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "O nome é obrigatório")
    @Size(max = 150)
    @Column(nullable = false, length = 150)
    private String nome;

    @NotBlank(message = "O e-mail é obrigatório")
    @Email(message = "E-mail inválido")
    @Column(nullable = false, length = 200)
    private String email;

    @NotBlank(message = "O CPF é obrigatório")
    @Size(min = 11, max = 11, message = "CPF deve ter 11 dígitos")
    @Column(nullable = false, length = 11)
    private String cpf;

    @Size(max = 20)
    @Column(length = 20)
    private String telefone;

    private LocalDate dataNascimento;

    // FK opcional: nem todo paciente tem convênio
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "convenio_id")   // sem nullable=false → permite NULL no banco
    private ConvenioEntity convenio;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() { createdAt = updatedAt = LocalDateTime.now(); }

    @PreUpdate
    void onUpdate() { updatedAt = LocalDateTime.now(); }
}
```

> **`FetchType.LAZY`** — o convênio só é carregado do banco quando você acessa `paciente.getConvenio()`.
> Evita JOINs desnecessários quando você só precisa do paciente.

---

### Arquivo 2 — `paciente/PacienteRepository.java`

```java
package br.edu.imepac.administrativo.paciente;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PacienteRepository extends JpaRepository<PacienteEntity, Long> {

    boolean existsByEmail(String email);

    boolean existsByCpf(String cpf);
}
```

---

### Arquivo 3 — `paciente/PacienteService.java`

```java
package br.edu.imepac.administrativo.paciente;

import br.edu.imepac.administrativo.convenio.ConvenioService;
import br.edu.imepac.commons.exceptions.BusinessException;
import br.edu.imepac.commons.exceptions.EntityNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class PacienteService {

    private final PacienteRepository pacienteRepository;
    private final ConvenioService convenioService;

    public PacienteService(PacienteRepository pacienteRepository, ConvenioService convenioService) {
        this.pacienteRepository = pacienteRepository;
        this.convenioService = convenioService;
    }

    public List<PacienteEntity> findAll() {
        return pacienteRepository.findAll();
    }

    public PacienteEntity findById(Long id) {
        return pacienteRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Paciente não encontrado com id: " + id));
    }

    public boolean existsById(Long id) {
        return pacienteRepository.existsById(id);
    }

    // convenioId é passado separado porque vem do Request (não da entidade)
    public PacienteEntity save(PacienteEntity paciente, Long convenioId) {
        if (pacienteRepository.existsByEmail(paciente.getEmail()))
            throw new BusinessException("E-mail já cadastrado");
        if (pacienteRepository.existsByCpf(paciente.getCpf()))
            throw new BusinessException("CPF já cadastrado");

        // Resolve a FK: busca a entidade de convênio se o ID foi informado
        // ConvenioService.findById lança EntityNotFoundException (404) se o ID não existir
        if (convenioId != null) {
            paciente.setConvenio(convenioService.findById(convenioId));
        }

        return pacienteRepository.save(paciente);
    }

    public PacienteEntity update(Long id, PacienteEntity dadosAtualizados, Long convenioId) {
        PacienteEntity existing = findById(id);
        existing.setNome(dadosAtualizados.getNome());
        existing.setTelefone(dadosAtualizados.getTelefone());
        existing.setDataNascimento(dadosAtualizados.getDataNascimento());
        existing.setConvenio(convenioId != null ? convenioService.findById(convenioId) : null);
        return pacienteRepository.save(existing);
    }

    public void deleteById(Long id) {
        if (!pacienteRepository.existsById(id))
            throw new EntityNotFoundException("Paciente não encontrado com id: " + id);
        pacienteRepository.deleteById(id);
    }
}
```

> **Por que `convenioId` é um parâmetro separado e não parte da entidade?**
> A entidade `PacienteEntity` tem um campo `ConvenioEntity convenio` (o objeto completo).
> O `PacienteRequest` tem um campo `Long convenioId` (só o ID que vem do JSON).
> O ModelMapper vai tentar mapear `convenioId` → `convenio` e não vai conseguir (tipos diferentes).
> A solução é: o controller mapeia request → entity (sem o convenio), passa o `convenioId` separado,
> e o service faz a resolução `convenioId → ConvenioEntity` via `ConvenioService`.

---

### Arquivo 4 — `paciente/dto/PacienteRequest.java`

```java
package br.edu.imepac.administrativo.paciente.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PacienteRequest {

    @NotBlank(message = "O nome é obrigatório")
    private String nome;

    @NotBlank(message = "O e-mail é obrigatório")
    @Email(message = "E-mail inválido")
    private String email;

    @NotBlank(message = "O CPF é obrigatório")
    @Size(min = 11, max = 11, message = "CPF deve ter 11 dígitos")
    private String cpf;

    private String telefone;

    private LocalDate dataNascimento;

    private Long convenioId;   // null = sem plano
}
```

---

### Arquivo 5 — `paciente/dto/PacienteResponse.java`

```java
package br.edu.imepac.administrativo.paciente.dto;

import br.edu.imepac.administrativo.convenio.dto.ConvenioResponse;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PacienteResponse {

    private Long id;
    private String nome;
    private String email;
    private String cpf;
    private String telefone;
    private LocalDate dataNascimento;
    private ConvenioResponse convenio;   // null se paciente não tem convênio
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
```

> O ModelMapper mapeia automaticamente `PacienteEntity.convenio` (do tipo `ConvenioEntity`) para
> `PacienteResponse.convenio` (do tipo `ConvenioResponse`) porque os nomes de campo batem.
> Se o paciente não tem convênio (`entity.getConvenio() == null`), o campo fica `null` na response
> — e o `@JsonInclude(NON_NULL)` do `ApiResponse` não vai incluir campos nulos no JSON.

---

### Arquivo 6 — `paciente/PacienteController.java`

```java
package br.edu.imepac.administrativo.paciente;

import br.edu.imepac.administrativo.paciente.dto.PacienteRequest;
import br.edu.imepac.administrativo.paciente.dto.PacienteResponse;
import br.edu.imepac.administrativo.shared.dto.ExistsResponse;
import br.edu.imepac.commons.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.modelmapper.ModelMapper;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Pacientes", description = "CRUD de pacientes")
@RestController
@RequestMapping("/v1/pacientes")
public class PacienteController {

    private final PacienteService pacienteService;
    private final ModelMapper modelMapper;

    public PacienteController(PacienteService pacienteService, ModelMapper modelMapper) {
        this.pacienteService = pacienteService;
        this.modelMapper = modelMapper;
    }

    @Operation(summary = "Listar todos os pacientes")
    @GetMapping
    public ResponseEntity<ApiResponse<List<PacienteResponse>>> findAll() {
        List<PacienteResponse> list = pacienteService.findAll()
                .stream()
                .map(entity -> modelMapper.map(entity, PacienteResponse.class))
                .toList();
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @Operation(summary = "Buscar paciente por ID")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<PacienteResponse>> findById(@PathVariable Long id) {
        PacienteResponse response = modelMapper.map(pacienteService.findById(id), PacienteResponse.class);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @Operation(summary = "Verificar se paciente existe — endpoint interno para Feign")
    @GetMapping("/{id}/exists")
    public ResponseEntity<ExistsResponse> exists(@PathVariable Long id) {
        return ResponseEntity.ok(new ExistsResponse(pacienteService.existsById(id)));
    }

    @Operation(summary = "Criar novo paciente")
    @PostMapping
    public ResponseEntity<ApiResponse<PacienteResponse>> create(@Valid @RequestBody PacienteRequest request) {
        PacienteEntity entity = modelMapper.map(request, PacienteEntity.class);
        // convenioId é passado separado — o service resolve a FK
        PacienteEntity saved = pacienteService.save(entity, request.getConvenioId());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(modelMapper.map(saved, PacienteResponse.class)));
    }

    @Operation(summary = "Atualizar paciente")
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<PacienteResponse>> update(@PathVariable Long id,
                                                               @Valid @RequestBody PacienteRequest request) {
        PacienteEntity entity = modelMapper.map(request, PacienteEntity.class);
        PacienteEntity updated = pacienteService.update(id, entity, request.getConvenioId());
        return ResponseEntity.ok(ApiResponse.success(modelMapper.map(updated, PacienteResponse.class)));
    }

    @Operation(summary = "Excluir paciente")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        pacienteService.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
```

---

### Validação

```bash
# Criar paciente SEM convênio
curl -s -u user:SENHA_GERADA -X POST http://localhost:8081/v1/pacientes \
  -H "Content-Type: application/json" \
  -d '{"nome":"Ana Costa","email":"ana@email.com","cpf":"11122233344","telefone":"31988880001","dataNascimento":"1990-05-15"}' | jq .
```

Saída esperada — `convenio` ausente do JSON (campo null removido pelo `@JsonInclude(NON_NULL)` do `ApiResponse`):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "nome": "Ana Costa",
    "email": "ana@email.com",
    "cpf": "11122233344",
    "telefone": "31988880001",
    "dataNascimento": "1990-05-15",
    "createdAt": "2026-05-12T10:00:00",
    "updatedAt": "2026-05-12T10:00:00"
  }
}
```

```bash
# Criar paciente COM convênio — use o ID retornado pelo PASSO 3
curl -s -u user:SENHA_GERADA -X POST http://localhost:8081/v1/pacientes \
  -H "Content-Type: application/json" \
  -d '{"nome":"Carlos Lima","email":"carlos@email.com","cpf":"55566677788","convenioId":1}' | jq .
```

Saída esperada — convenio aparece aninhado:
```json
{
  "success": true,
  "data": {
    "id": 2,
    "nome": "Carlos Lima",
    "convenio": { "id": 1, "nome": "Unimed", "descricao": "Plano Premium" }
  }
}
```

```bash
# /exists
curl -s -u user:SENHA_GERADA http://localhost:8081/v1/pacientes/1/exists | jq .
# → {"exists": true}

# convenioId inexistente — EntityNotFoundException do ConvenioService → 404
curl -s -u user:SENHA_GERADA -X POST http://localhost:8081/v1/pacientes \
  -H "Content-Type: application/json" \
  -d '{"nome":"Teste","email":"t@t.com","cpf":"99988877766","convenioId":999}' | jq .
# → {"success":false,"message":"Convênio não encontrado com id: 999"}

# CPF duplicado — BusinessException → 422
curl -s -u user:SENHA_GERADA -X POST http://localhost:8081/v1/pacientes \
  -H "Content-Type: application/json" \
  -d '{"nome":"Outro","email":"outro@email.com","cpf":"11122233344"}' | jq .
# → {"success":false,"message":"CPF já cadastrado"}

# Verificar banco — convenio_id nullable
docker compose exec mysql mysql -uroot clinica_administrativo \
  -e "SELECT id, nome, cpf, convenio_id FROM pacientes;"
```

### Ponto de controle — avance somente quando:

- [ ] Criar paciente sem convênio → `201`, campo `convenio` ausente do JSON
- [ ] Criar paciente com `convenioId` válido → `201`, objeto `convenio` aninhado na resposta
- [ ] Criar paciente com `convenioId` inexistente → `404` com mensagem de convênio não encontrado
- [ ] CPF duplicado → `422` com `"message":"CPF já cadastrado"`
- [ ] E-mail duplicado → `422` com `"message":"E-mail já cadastrado"`
- [ ] `GET /v1/pacientes/{id}/exists` retorna `{"exists":true}` ou `{"exists":false}`
- [ ] `DESCRIBE pacientes` mostra `convenio_id` como `bigint DEFAULT NULL`

---

## PASSO 6 — Auth: usuários e emissão de JWT [2h]

> Criar o mecanismo de autenticação: tabela de usuários, geração de tokens JWT e endpoint de login.
> Após este passo você terá um JWT real para testar o Security no PASSO 7.

**Depende de:** PASSO 5 concluído.

### Estrutura de arquivos

```
administrativo/src/main/java/br/edu/imepac/administrativo/auth/
├── Role.java               ← enum com os perfis de acesso
├── UsuarioEntity.java
├── UsuarioRepository.java
├── JwtService.java         ← gera e valida tokens JWT
├── AuthService.java        ← lógica de login e registro
├── AuthController.java     ← endpoints /auth/login e /auth/register
└── dto/
    ├── LoginRequest.java
    ├── LoginResponse.java
    ├── RegisterRequest.java
    └── UsuarioResponse.java
```

---

### Arquivo 1 — `auth/Role.java`

```java
package br.edu.imepac.administrativo.auth;

public enum Role {
    ADMIN,          // acesso total
    RECEPCIONISTA,  // cadastros e agendamentos
    MEDICO,         // atendimentos
    PACIENTE        // visualização própria
}
```

---

### Arquivo 2 — `auth/UsuarioEntity.java`

```java
package br.edu.imepac.administrativo.auth;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "usuarios", uniqueConstraints = @UniqueConstraint(columnNames = "email"))
public class UsuarioEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String nome;

    @Column(nullable = false, length = 200)
    private String email;

    @Column(nullable = false)
    private String senhaHash;   // NUNCA armazene senha em texto puro — sempre BCrypt

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() { createdAt = LocalDateTime.now(); }
}
```

---

### Arquivo 3 — `auth/UsuarioRepository.java`

```java
package br.edu.imepac.administrativo.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UsuarioRepository extends JpaRepository<UsuarioEntity, Long> {

    Optional<UsuarioEntity> findByEmail(String email);

    boolean existsByEmail(String email);
}
```

---

### Arquivo 4 — `auth/JwtService.java`

```java
package br.edu.imepac.administrativo.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Service
public class JwtService {

    private final SecretKey key;
    private final long expirationMillis;

    public JwtService(@Value("${jwt.secret}") String secret,
                      @Value("${jwt.expiration-ms:86400000}") long expirationMillis) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMillis = expirationMillis;
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

    public Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public long getExpirationMillis() {
        return expirationMillis;
    }
}
```

> **Imports do JJWT 0.12.x** — use sempre os do pacote `io.jsonwebtoken`. Se o IntelliJ sugerir
> imports alternativos (como `javax.crypto.SecretKey`), confirme que é o correto — é da JDK mesmo.

---

### Arquivo 5 — `auth/dto/LoginRequest.java`

```java
package br.edu.imepac.administrativo.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        @NotBlank @Email String email,
        @NotBlank String senha
) {}
```

---

### Arquivo 6 — `auth/dto/LoginResponse.java`

```java
package br.edu.imepac.administrativo.auth.dto;

import br.edu.imepac.administrativo.auth.Role;

public record LoginResponse(
        String token,
        long expiresInSeconds,
        String email,
        Role role
) {}
```

---

### Arquivo 7 — `auth/dto/RegisterRequest.java`

```java
package br.edu.imepac.administrativo.auth.dto;

import br.edu.imepac.administrativo.auth.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank String nome,
        @NotBlank @Email String email,
        @NotBlank @Size(min = 6) String senha,
        @NotNull Role role
) {}
```

---

### Arquivo 8 — `auth/dto/UsuarioResponse.java`

```java
package br.edu.imepac.administrativo.auth.dto;

import br.edu.imepac.administrativo.auth.Role;

public record UsuarioResponse(
        Long id,
        String nome,
        String email,
        Role role
) {}
```

---

### Arquivo 9 — `auth/AuthService.java`

```java
package br.edu.imepac.administrativo.auth;

import br.edu.imepac.administrativo.auth.dto.LoginRequest;
import br.edu.imepac.administrativo.auth.dto.LoginResponse;
import br.edu.imepac.administrativo.auth.dto.RegisterRequest;
import br.edu.imepac.administrativo.auth.dto.UsuarioResponse;
import br.edu.imepac.commons.exceptions.BusinessException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UsuarioRepository usuarioRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    public LoginResponse login(LoginRequest request) {
        UsuarioEntity user = usuarioRepository.findByEmail(request.email())
                .orElseThrow(() -> new BusinessException("Credenciais inválidas"));

        // Nunca diga qual campo está errado — evita user enumeration
        if (!passwordEncoder.matches(request.senha(), user.getSenhaHash())) {
            throw new BusinessException("Credenciais inválidas");
        }

        String token = jwtService.generate(user);
        long expiresInSeconds = jwtService.getExpirationMillis() / 1000;

        return new LoginResponse(token, expiresInSeconds, user.getEmail(), user.getRole());
    }

    public UsuarioResponse register(RegisterRequest request) {
        if (usuarioRepository.existsByEmail(request.email()))
            throw new BusinessException("E-mail já cadastrado");

        UsuarioEntity user = UsuarioEntity.builder()
                .nome(request.nome())
                .email(request.email())
                .senhaHash(passwordEncoder.encode(request.senha()))
                .role(request.role())
                .build();

        UsuarioEntity saved = usuarioRepository.save(user);
        return new UsuarioResponse(saved.getId(), saved.getNome(), saved.getEmail(), saved.getRole());
    }
}
```

---

### Arquivo 10 — `auth/AuthController.java`

```java
package br.edu.imepac.administrativo.auth;

import br.edu.imepac.administrativo.auth.dto.LoginRequest;
import br.edu.imepac.administrativo.auth.dto.LoginResponse;
import br.edu.imepac.administrativo.auth.dto.RegisterRequest;
import br.edu.imepac.administrativo.auth.dto.UsuarioResponse;
import br.edu.imepac.commons.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Autenticação", description = "Login e registro de usuários")
@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @Operation(summary = "Fazer login e obter token JWT")
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(ApiResponse.success(authService.login(request)));
    }

    @Operation(summary = "Registrar novo usuário — apenas ADMIN")
    @PostMapping("/register")
    public ResponseEntity<ApiResponse<UsuarioResponse>> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(authService.register(request)));
    }
}
```

---

### Arquivo 11 — Atualizar `AdministrativoApplication.java` (seed do admin)

```java
package br.edu.imepac.administrativo;

import br.edu.imepac.administrativo.auth.Role;
import br.edu.imepac.administrativo.auth.UsuarioEntity;
import br.edu.imepac.administrativo.auth.UsuarioRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;

@SpringBootApplication
public class AdministrativoApplication {

    public static void main(String[] args) {
        SpringApplication.run(AdministrativoApplication.class, args);
    }

    @Bean
    @Profile("!test")   // não roda durante testes automatizados
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
}
```

> **`@Profile("!test")`** — garante que o seed não rode nos testes de integração com Testcontainers,
> onde o banco começa vazio e o seed pode causar falsos positivos.
> **`PasswordEncoder`** — o bean é declarado no `SecurityConfig` (PASSO 7). O Spring injeta aqui.

---

### Validação

```bash
# Subir o serviço e verificar o seed
mvn spring-boot:run -pl administrativo

# O console deve mostrar que o admin foi criado (se você tiver um log no seedAdmin)
# Verificar no banco
docker compose exec mysql mysql -uroot clinica_administrativo \
  -e "SELECT id, nome, email, role FROM usuarios;"
# → deve mostrar o admin@clinica.com com role=ADMIN

# Fazer login
curl -s -X POST http://localhost:8081/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clinica.com","senha":"admin123"}' | jq .
```

Saída esperada (`200 OK`):
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzM4NC...",
    "expiresInSeconds": 86400,
    "email": "admin@clinica.com",
    "role": "ADMIN"
  }
}
```

```bash
# Guardar o token para usar nos próximos testes
TOKEN=$(curl -s -X POST http://localhost:8081/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clinica.com","senha":"admin123"}' | jq -r '.data.token')

echo $TOKEN   # deve imprimir a string eyJ...

# Senha errada → 422 com mensagem genérica (nunca diga qual campo está errado)
curl -s -X POST http://localhost:8081/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clinica.com","senha":"errada"}' | jq .
# → {"success":false,"message":"Credenciais inválidas"}

# Validar o JWT em https://jwt.io — cole o token e verifique os claims
# Deve conter: sub, uid, nome, role, iat, exp
```

### Ponto de controle — avance somente quando:

- [ ] `POST /auth/login` retorna JWT (string começando com `eyJ`)
- [ ] Campo `role` visível no payload do JWT (verificar em jwt.io)
- [ ] `POST /auth/login` com senha errada retorna `422` com `"Credenciais inválidas"`
- [ ] Tabela `usuarios` tem o admin seedado
- [ ] `PasswordEncoder` está disponível como bean (sem erros de `NoSuchBeanDefinitionException`)

---

## PASSO 7 — Spring Security: filtro JWT e autorização por role [1h30]

> Ativar a proteção dos endpoints. Após este passo, qualquer requisição sem
> `Authorization: Bearer <token>` retorna `401`. Endpoints públicos são explicitamente liberados.

**Depende de:** PASSO 6 concluído — precisa do `JwtService` para o filtro e de um token para testar.

### Estrutura de arquivos

```
administrativo/src/main/java/br/edu/imepac/administrativo/
└── config/
    ├── JwtAuthFilter.java    ← lê o token do header e seta a autenticação no Spring Security
    └── SecurityConfig.java   ← define quais endpoints são públicos e quais exigem JWT
```

---

### Arquivo 1 — `config/JwtAuthFilter.java`

```java
package br.edu.imepac.administrativo.config;

import br.edu.imepac.administrativo.auth.JwtService;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    public JwtAuthFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");

        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            try {
                Claims claims = jwtService.extractAllClaims(token);
                String role = claims.get("role", String.class);

                // Cria o objeto de autenticação com o email (subject) e a role
                var auth = new UsernamePasswordAuthenticationToken(
                        claims.getSubject(),
                        null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + role))
                );
                SecurityContextHolder.getContext().setAuthentication(auth);
            } catch (Exception e) {
                // Token inválido ou expirado: não seta autenticação
                // O SecurityConfig vai retornar 401 para endpoints protegidos
            }
        }

        chain.doFilter(request, response);
    }
}
```

> **`OncePerRequestFilter`** garante que o filtro é executado exatamente uma vez por requisição,
> mesmo que haja redirecionamentos internos no Spring.
>
> **Por que não retornamos 401 aqui?** Porque o filtro também processa requisições para endpoints
> públicos (como `/auth/login`). Se o token estiver ausente, simplesmente não setamos autenticação —
> e o `SecurityConfig` decide se o endpoint precisa ou não de autenticação.

---

### Arquivo 2 — `config/SecurityConfig.java`

```java
package br.edu.imepac.administrativo.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity   // habilita @PreAuthorize nos controllers
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter) {
        this.jwtAuthFilter = jwtAuthFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
                .csrf(AbstractHttpConfigurer::disable)          // API REST sem estado — CSRF não se aplica
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS))  // sem sessão HTTP
                .authorizeHttpRequests(auth -> auth
                        // Autenticação
                        .requestMatchers("/auth/login").permitAll()
                        // Swagger UI
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                        // Actuator health (Docker healthcheck)
                        .requestMatchers("/actuator/health").permitAll()
                        // Endpoints internos entre serviços via Feign — sem JWT
                        .requestMatchers("/v1/medicos/*/exists", "/v1/pacientes/*/exists").permitAll()
                        // Tudo mais exige token válido
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
```

---

### Arquivo 3 — Adicionar `@PreAuthorize` nos controllers

Adicione a anotação em cada método dos controllers. `@EnableMethodSecurity` no `SecurityConfig`
é o que faz essas anotações funcionarem.

**`ConvenioController.java`** — adicione sobre cada método:

```java
import org.springframework.security.access.prepost.PreAuthorize;

// GET /v1/convenios
@PreAuthorize("hasAnyRole('ADMIN', 'RECEPCIONISTA', 'MEDICO')")
@GetMapping
public ResponseEntity<ApiResponse<List<ConvenioResponse>>> findAll() { ... }

// GET /v1/convenios/{id}
@PreAuthorize("hasAnyRole('ADMIN', 'RECEPCIONISTA', 'MEDICO')")
@GetMapping("/{id}")
public ResponseEntity<ApiResponse<ConvenioResponse>> findById(...) { ... }

// POST /v1/convenios
@PreAuthorize("hasRole('ADMIN')")
@PostMapping
public ResponseEntity<ApiResponse<ConvenioResponse>> create(...) { ... }

// PUT /v1/convenios/{id}
@PreAuthorize("hasRole('ADMIN')")
@PutMapping("/{id}")
public ResponseEntity<ApiResponse<ConvenioResponse>> update(...) { ... }

// DELETE /v1/convenios/{id}
@PreAuthorize("hasRole('ADMIN')")
@DeleteMapping("/{id}")
public ResponseEntity<Void> delete(...) { ... }
```

**`MedicoController.java`** e **`PacienteController.java`** — mesma lógica de roles.

**`AuthController.java`** — proteger o registro:

```java
// POST /auth/register — apenas ADMIN pode criar outros usuários
@PreAuthorize("hasRole('ADMIN')")
@PostMapping("/register")
public ResponseEntity<ApiResponse<UsuarioResponse>> register(...) { ... }
```

> **Como `hasRole('ADMIN')` funciona?** O `JwtAuthFilter` cria a autenticação com
> `SimpleGrantedAuthority("ROLE_ADMIN")`. O Spring Security adiciona o prefixo `ROLE_`
> automaticamente quando você usa `hasRole()`. Por isso a role no JWT é `"ADMIN"` (sem prefixo)
> mas o `hasRole` recebe `"ADMIN"` — o Spring concatena internamente.

---

### Validação

```bash
# Pegar o token do admin (já criado no PASSO 6)
TOKEN=$(curl -s -X POST http://localhost:8081/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clinica.com","senha":"admin123"}' | jq -r '.data.token')

# 1. Sem token → 401
curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:8081/v1/convenios
# → Status: 401

# 2. Com token válido → 200
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8081/v1/convenios | jq .
# → {"success":true,"data":[...]}

# 3. Token com string inválida → 401
curl -s -o /dev/null -w "Status: %{http_code}\n" \
  -H "Authorization: Bearer ISSO.NAO.E.UM.JWT" \
  http://localhost:8081/v1/convenios
# → Status: 401

# 4. Criar RECEPCIONISTA e testar restrições de role
curl -s -X POST http://localhost:8081/auth/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"nome":"Maria","email":"maria@clinica.com","senha":"senha123","role":"RECEPCIONISTA"}' | jq .

TOKEN_REC=$(curl -s -X POST http://localhost:8081/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"maria@clinica.com","senha":"senha123"}' | jq -r '.data.token')

# Recepcionista pode listar → 200
curl -s -o /dev/null -w "Status: %{http_code}\n" \
  -H "Authorization: Bearer $TOKEN_REC" http://localhost:8081/v1/convenios
# → Status: 200

# Recepcionista NÃO pode deletar → 403
curl -s -o /dev/null -w "Status: %{http_code}\n" \
  -X DELETE -H "Authorization: Bearer $TOKEN_REC" \
  http://localhost:8081/v1/convenios/1
# → Status: 403

# 5. Endpoints públicos — sem token
curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:8081/actuator/health
# → Status: 200

curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:8081/v1/medicos/1/exists
# → Status: 200
```

### Ponto de controle — avance somente quando:

- [ ] `GET /v1/convenios` sem token → `401`
- [ ] `GET /v1/convenios` com token ADMIN → `200`
- [ ] `GET /v1/convenios` com token inválido → `401`
- [ ] `DELETE /v1/convenios/{id}` com token RECEPCIONISTA → `403`
- [ ] `GET /v1/medicos/{id}/exists` sem token → `200` (endpoint público)
- [ ] `GET /actuator/health` sem token → `200` (endpoint público)
- [ ] `GET /swagger-ui.html` sem token → `200` (Swagger acessível sem login)
- [ ] `POST /auth/register` sem token → `401` (protegido pelo Security)

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
    <artifactId>spring-cloud-starter-gateway-server-webflux</artifactId>
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
      server:
        webflux:
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
