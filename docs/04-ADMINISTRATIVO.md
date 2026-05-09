# 04 — Serviço `administrativo`

> Cadastros mestres da clínica: Convênio, Paciente e Médico. Porta **8081**. Tempo estimado: 4h.

## Domínios

| Entidade | Estado atual | A fazer |
|---|---|---|
| `Convenio` | Existe no `commons` (precisa migrar) e CRUD existe no `administrativo` | Migrar entidade para o módulo, adaptar Controller para `ApiResponse<T>` |
| `Paciente` | Não existe | Implementar do zero, com FK opcional para `Convenio` |
| `Medico` | Não existe | Implementar do zero |
| `Usuario` (auth) | Não existe | Implementar (ver [`08-SEGURANCA.md`](08-SEGURANCA.md)) |

---

## Estrutura de pacotes alvo

```
administrativo/src/main/java/br/edu/imepac/administrativo/
├── AdministrativoApplication.java
├── auth/                         ← detalhado em 08-SEGURANCA.md
│   ├── AuthController.java
│   ├── AuthService.java
│   ├── JwtService.java
│   ├── UsuarioEntity.java
│   ├── UsuarioRepository.java
│   ├── dto/
│   └── enums/Role.java
├── convenio/
│   ├── ConvenioController.java
│   ├── ConvenioService.java
│   ├── ConvenioRepository.java
│   ├── ConvenioEntity.java
│   └── dto/
│       ├── ConvenioRequest.java
│       └── ConvenioResponse.java
├── paciente/
│   ├── PacienteController.java
│   ├── PacienteService.java
│   ├── PacienteRepository.java
│   ├── PacienteEntity.java
│   └── dto/
│       ├── PacienteRequest.java
│       ├── PacienteUpdateRequest.java
│       └── PacienteResponse.java
└── medico/
    ├── MedicoController.java
    ├── MedicoService.java
    ├── MedicoRepository.java
    ├── MedicoEntity.java
    └── dto/
        ├── MedicoRequest.java
        ├── MedicoUpdateRequest.java
        └── MedicoResponse.java
```

> Estilo "package-by-feature" (cada domínio é um pacote). Mais idiomático em projetos Spring Boot modernos do que o antigo "package-by-layer" (controller/, service/, repository/, dto/ globais). Use o que preferir — só seja consistente.

---

## `application.yml`

Migrar de `application.properties` para YAML é opcional, mas recomendado. Aqui o exemplo:

```yaml
server:
  port: ${SERVER_PORT:8081}

spring:
  application:
    name: administrativo
  datasource:
    url: jdbc:mysql://${DB_HOST:localhost}:${DB_PORT:3307}/${DB_NAME:clinica_administrativo}?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=America/Sao_Paulo
    username: ${DB_USER:root}
    password: ${DB_PASSWORD:root}
    driver-class-name: com.mysql.cj.jdbc.Driver
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: ${JPA_SHOW_SQL:false}
    properties:
      hibernate:
        format_sql: true
        dialect: org.hibernate.dialect.MySQLDialect

springdoc:
  swagger-ui:
    path: /swagger-ui.html
    operations-sorter: method
    tags-sorter: alpha

logbook:
  format:
    style: http
  predicate:
    exclude:
      - path: /actuator/**
      - path: /swagger-ui/**

logging:
  level:
    br.edu.imepac: DEBUG
    org.zalando.logbook: TRACE

jwt:
  secret: ${JWT_SECRET:dev-secret-please-change-in-production-with-256-bits-minimum}
  expiration: ${JWT_EXPIRATION:3600000}  # 1h em ms
```

---

## `administrativo/pom.xml`

Adicione (sobre o que já existe):

```xml
<!-- Spring Cloud OpenFeign (consumido pelos OUTROS serviços, mas precisa estar no BOM) -->
<!-- Não é dependência do administrativo; mantém apenas o que ele usa: -->

<!-- OpenAPI / Swagger -->
<dependency>
    <groupId>org.springdoc</groupId>
    <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
    <version>2.6.0</version>
</dependency>

<!-- Logbook -->
<dependency>
    <groupId>org.zalando</groupId>
    <artifactId>logbook-spring-boot-starter</artifactId>
    <version>3.9.0</version>
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

E no parent (`pom.xml` raiz), adicione:

```xml
<properties>
    <java.version>17</java.version>
    <spring-boot.version>3.3.5</spring-boot.version>
    <spring-cloud.version>2023.0.3</spring-cloud.version>
    <testcontainers.version>1.20.4</testcontainers.version>
</properties>

<dependencyManagement>
    <dependencies>
        <!-- ... existentes ... -->

        <dependency>
            <groupId>org.springframework.cloud</groupId>
            <artifactId>spring-cloud-dependencies</artifactId>
            <version>${spring-cloud.version}</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
        <dependency>
            <groupId>org.testcontainers</groupId>
            <artifactId>testcontainers-bom</artifactId>
            <version>${testcontainers.version}</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>
```

---

## `AdministrativoApplication`

```java
package br.edu.imepac.administrativo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "br.edu.imepac")
public class AdministrativoApplication {
    public static void main(String[] args) {
        SpringApplication.run(AdministrativoApplication.class, args);
    }
}
```

> `scanBasePackages = "br.edu.imepac"` faz o Spring varrer o `commons` também. Combinado com a auto-configuration do commons, registra o `GlobalExceptionHandler` e o `ModelMapper` automaticamente.
>
> Removemos as anotações `@EntityScan` e `@EnableJpaRepositories` que apontavam para o pacote antigo do commons — agora as entidades estão dentro de `br.edu.imepac.administrativo` e são descobertas pelo classpath scan padrão.

---

## Convênio (refatorado)

### `ConvenioEntity`

```java
package br.edu.imepac.administrativo.convenio;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "convenios")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConvenioEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Size(max = 150)
    @Column(nullable = false, length = 150)
    private String nome;

    @Size(max = 500)
    @Column(length = 500)
    private String descricao;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
```

### `ConvenioRequest` / `ConvenioResponse`

```java
package br.edu.imepac.administrativo.convenio.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ConvenioRequest {
    @NotBlank
    @Size(max = 150)
    private String nome;

    @Size(max = 500)
    private String descricao;
}
```

```java
@Data
@Builder
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

### `ConvenioRepository`

```java
package br.edu.imepac.administrativo.convenio;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ConvenioRepository extends JpaRepository<ConvenioEntity, Long> {
    boolean existsByNomeIgnoreCase(String nome);
}
```

### `ConvenioService`

```java
package br.edu.imepac.administrativo.convenio;

import br.edu.imepac.administrativo.convenio.dto.ConvenioRequest;
import br.edu.imepac.administrativo.convenio.dto.ConvenioResponse;
import br.edu.imepac.commons.exception.BusinessException;
import br.edu.imepac.commons.exception.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.modelmapper.ModelMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class ConvenioService {

    private final ConvenioRepository repository;
    private final ModelMapper modelMapper;

    @Transactional(readOnly = true)
    public List<ConvenioResponse> findAll() {
        return repository.findAll().stream()
                .map(c -> modelMapper.map(c, ConvenioResponse.class))
                .toList();
    }

    @Transactional(readOnly = true)
    public ConvenioResponse findById(Long id) {
        ConvenioEntity entity = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Convênio", id));
        return modelMapper.map(entity, ConvenioResponse.class);
    }

    public ConvenioResponse create(ConvenioRequest request) {
        if (repository.existsByNomeIgnoreCase(request.getNome())) {
            throw new BusinessException("Já existe um convênio com o nome '" + request.getNome() + "'");
        }
        ConvenioEntity entity = modelMapper.map(request, ConvenioEntity.class);
        return modelMapper.map(repository.save(entity), ConvenioResponse.class);
    }

    public ConvenioResponse update(Long id, ConvenioRequest request) {
        ConvenioEntity entity = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Convênio", id));
        entity.setNome(request.getNome());
        entity.setDescricao(request.getDescricao());
        return modelMapper.map(repository.save(entity), ConvenioResponse.class);
    }

    public void delete(Long id) {
        if (!repository.existsById(id)) {
            throw new EntityNotFoundException("Convênio", id);
        }
        repository.deleteById(id);
    }

    ConvenioEntity findEntityById(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Convênio", id));
    }
}
```

### `ConvenioController`

```java
package br.edu.imepac.administrativo.convenio;

import br.edu.imepac.administrativo.convenio.dto.ConvenioRequest;
import br.edu.imepac.administrativo.convenio.dto.ConvenioResponse;
import br.edu.imepac.commons.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/v1/convenios")
@RequiredArgsConstructor
@Tag(name = "Convênio", description = "Gestão de convênios médicos")
public class ConvenioController {

    private final ConvenioService service;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','RECEPCIONISTA')")
    @Operation(summary = "Lista todos os convênios")
    public ResponseEntity<ApiResponse<List<ConvenioResponse>>> findAll() {
        return ResponseEntity.ok(ApiResponse.success(service.findAll()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','RECEPCIONISTA')")
    @Operation(summary = "Busca convênio por id")
    public ResponseEntity<ApiResponse<ConvenioResponse>> findById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(service.findById(id)));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Cria um convênio")
    public ResponseEntity<ApiResponse<ConvenioResponse>> create(@Valid @RequestBody ConvenioRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Convênio criado", service.create(request)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Atualiza um convênio")
    public ResponseEntity<ApiResponse<ConvenioResponse>> update(@PathVariable Long id,
                                                                @Valid @RequestBody ConvenioRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Convênio atualizado", service.update(id, request)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Remove um convênio")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
```

---

## Paciente (novo)

### `PacienteEntity`

```java
package br.edu.imepac.administrativo.paciente;

import br.edu.imepac.administrativo.convenio.ConvenioEntity;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "pacientes",
       uniqueConstraints = {
           @UniqueConstraint(columnNames = "email"),
           @UniqueConstraint(columnNames = "cpf")
       })
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PacienteEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Size(max = 150)
    @Column(nullable = false, length = 150)
    private String nome;

    @NotBlank
    @Email
    @Column(nullable = false, length = 200)
    private String email;

    @NotBlank
    @Pattern(regexp = "\\d{11}", message = "CPF deve conter 11 dígitos numéricos")
    @Column(nullable = false, length = 11)
    private String cpf;

    @Size(max = 20)
    @Column(length = 20)
    private String telefone;

    @Past
    private LocalDate dataNascimento;

    /** Convênio é OPCIONAL — nullable. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "convenio_id")
    private ConvenioEntity convenio;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist void onCreate()  { createdAt = updatedAt = LocalDateTime.now(); }
    @PreUpdate  void onUpdate()  { updatedAt = LocalDateTime.now(); }
}
```

### DTOs

```java
// PacienteRequest.java
@Data @NoArgsConstructor @AllArgsConstructor
public class PacienteRequest {
    @NotBlank @Size(max = 150) private String nome;
    @NotBlank @Email          private String email;
    @NotBlank @Pattern(regexp = "\\d{11}") private String cpf;
    private String telefone;
    @Past private LocalDate dataNascimento;
    private Long convenioId;   // pode ser null
}
```

```java
// PacienteUpdateRequest.java — todos opcionais
@Data @NoArgsConstructor @AllArgsConstructor
public class PacienteUpdateRequest {
    @Size(max = 150) private String nome;
    @Email           private String email;
    private String telefone;
    @Past            private LocalDate dataNascimento;
    private Long convenioId;  // null para "remover convênio"
}
```

```java
// PacienteResponse.java
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class PacienteResponse {
    private Long id;
    private String nome;
    private String email;
    private String cpf;
    private String telefone;
    private LocalDate dataNascimento;
    private ConvenioResponse convenio;  // null se sem convênio
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
```

### `PacienteRepository`

```java
public interface PacienteRepository extends JpaRepository<PacienteEntity, Long> {
    boolean existsByEmail(String email);
    boolean existsByCpf(String cpf);
}
```

### `PacienteService` (esqueleto)

```java
@Service
@RequiredArgsConstructor
@Transactional
public class PacienteService {

    private final PacienteRepository repository;
    private final ConvenioService convenioService;
    private final ModelMapper modelMapper;

    @Transactional(readOnly = true)
    public List<PacienteResponse> findAll() { ... }

    @Transactional(readOnly = true)
    public PacienteResponse findById(Long id) {
        return toResponse(findEntity(id));
    }

    @Transactional(readOnly = true)
    public boolean exists(Long id) {
        return repository.existsById(id);
    }

    public PacienteResponse create(PacienteRequest req) {
        if (repository.existsByEmail(req.getEmail()))
            throw new BusinessException("E-mail já cadastrado");
        if (repository.existsByCpf(req.getCpf()))
            throw new BusinessException("CPF já cadastrado");

        PacienteEntity entity = modelMapper.map(req, PacienteEntity.class);
        if (req.getConvenioId() != null) {
            entity.setConvenio(convenioService.findEntityById(req.getConvenioId()));
        }
        return toResponse(repository.save(entity));
    }

    public PacienteResponse update(Long id, PacienteUpdateRequest req) {
        PacienteEntity entity = findEntity(id);
        if (req.getNome() != null)            entity.setNome(req.getNome());
        if (req.getEmail() != null)           entity.setEmail(req.getEmail());
        if (req.getTelefone() != null)        entity.setTelefone(req.getTelefone());
        if (req.getDataNascimento() != null)  entity.setDataNascimento(req.getDataNascimento());
        if (req.getConvenioId() != null) {
            entity.setConvenio(convenioService.findEntityById(req.getConvenioId()));
        }
        return toResponse(repository.save(entity));
    }

    public void delete(Long id) {
        if (!repository.existsById(id)) throw new EntityNotFoundException("Paciente", id);
        repository.deleteById(id);
    }

    private PacienteEntity findEntity(Long id) {
        return repository.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Paciente", id));
    }

    private PacienteResponse toResponse(PacienteEntity e) {
        return modelMapper.map(e, PacienteResponse.class);
    }
}
```

### `PacienteController`

```java
@RestController
@RequestMapping("/v1/pacientes")
@RequiredArgsConstructor
@Tag(name = "Paciente")
public class PacienteController {

    private final PacienteService service;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','RECEPCIONISTA')")
    public ResponseEntity<ApiResponse<List<PacienteResponse>>> findAll() {
        return ResponseEntity.ok(ApiResponse.success(service.findAll()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','RECEPCIONISTA')")
    public ResponseEntity<ApiResponse<PacienteResponse>> findById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(service.findById(id)));
    }

    /** Endpoint usado por outros serviços via Feign. */
    @GetMapping("/{id}/exists")
    public ExistsResponse exists(@PathVariable Long id) {
        return new ExistsResponse(service.exists(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','RECEPCIONISTA')")
    public ResponseEntity<ApiResponse<PacienteResponse>> create(@Valid @RequestBody PacienteRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Paciente criado", service.create(req)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','RECEPCIONISTA')")
    public ResponseEntity<ApiResponse<PacienteResponse>> update(@PathVariable Long id,
                                                                @Valid @RequestBody PacienteUpdateRequest req) {
        return ResponseEntity.ok(ApiResponse.success("Paciente atualizado", service.update(id, req)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
```

---

## Médico (novo)

Estrutura idêntica a Paciente. Diferenças:

- Sem FK para Convênio.
- Campo `crm` único (substitui `cpf`).
- Campo `especialidade` obrigatório.

```java
// MedicoEntity.java — campos
private String nome;
private String email;     // unique
private String crm;       // unique, formato livre (ex: "CRM/MG 123456")
private String especialidade;
private String telefone;
```

Endpoints análogos a Paciente, incluindo `/v1/medicos/{id}/exists`.

---

## Verificação manual

Suba o serviço e teste:

```bash
mvn spring-boot:run -pl administrativo
```

```bash
# Listar convênios (esperado vazio inicialmente)
curl http://localhost:8081/v1/convenios

# Criar convênio
curl -X POST http://localhost:8081/v1/convenios \
  -H "Content-Type: application/json" \
  -d '{"nome":"Unimed","descricao":"Plano Premium"}'

# Criar paciente sem convênio
curl -X POST http://localhost:8081/v1/pacientes \
  -H "Content-Type: application/json" \
  -d '{"nome":"João","email":"joao@test.com","cpf":"12345678901","telefone":"31999999999","dataNascimento":"1990-01-01"}'

# Criar paciente com convênio (id=1)
curl -X POST http://localhost:8081/v1/pacientes \
  -H "Content-Type: application/json" \
  -d '{"nome":"Maria","email":"maria@test.com","cpf":"12345678902","convenioId":1}'

# Verificar exists (Feign endpoint)
curl http://localhost:8081/v1/pacientes/1/exists
# → {"exists":true}

# Validation error (CPF inválido)
curl -X POST http://localhost:8081/v1/pacientes \
  -H "Content-Type: application/json" \
  -d '{"nome":"X","email":"x@x.com","cpf":"123"}'
# → 400 com lista de erros do GlobalExceptionHandler
```

> **Nota sobre segurança:** os exemplos acima ignoram autenticação. Após a Fase 6, os endpoints exigirão `Authorization: Bearer ...`. Os endpoints `/exists` permanecem abertos (uso interno entre serviços).

---

## Checklist final do administrativo

- [ ] `Convenio*` migrados do commons (Fase 1)
- [ ] `application.yml` com env vars
- [ ] `ConvenioController` retornando `ApiResponse<T>`
- [ ] `PacienteEntity` com FK opcional para `Convenio`
- [ ] `MedicoEntity` com `crm` único
- [ ] Endpoints `/exists` em Paciente e Médico
- [ ] Swagger acessível em `/swagger-ui.html`
- [ ] Logbook logando requisições no console
- [ ] Banco `clinica_administrativo` com 3 tabelas (`convenios`, `pacientes`, `medicos`)
- [ ] FK `convenio_id` em `pacientes` é nullable

---

## Próximo passo

[`05-AGENDAMENTO.md`](05-AGENDAMENTO.md) — Agendamento + comunicação Feign.
