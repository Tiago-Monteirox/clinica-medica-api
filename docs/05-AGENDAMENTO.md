# 05 — Serviço `agendamento`

> Gestão de agenda. Porta **8082**. Comunica com `administrativo` via Feign para validar paciente/médico. Tempo estimado: 3h.

## Pré-requisitos

- `commons` refatorado (Fase 1).
- `administrativo` com endpoints `/v1/pacientes/{id}/exists` e `/v1/medicos/{id}/exists` no ar.
- BOM do Spring Cloud já no parent `pom.xml` (ver `04-ADMINISTRATIVO.md` § "administrativo/pom.xml").

---

## Estrutura

```
agendamento/src/main/java/br/edu/imepac/agendamento/
├── AgendamentoApplication.java
├── client/
│   ├── AdministrativoClient.java
│   └── FeignConfig.java
├── config/
│   └── SwaggerConfig.java   (opcional)
├── agendamento/
│   ├── AgendamentoController.java
│   ├── AgendamentoService.java
│   ├── AgendamentoRepository.java
│   ├── AgendamentoEntity.java
│   ├── enums/StatusAgendamento.java
│   └── dto/
│       ├── AgendamentoRequest.java
│       ├── AgendamentoUpdateRequest.java
│       └── AgendamentoResponse.java
└── security/                 (filtro JWT — ver 08-SEGURANCA.md)
```

---

## `agendamento/pom.xml`

```xml
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>br.edu.imepac</groupId>
        <artifactId>clinica-medica</artifactId>
        <version>1.0-SNAPSHOT</version>
        <relativePath>../pom.xml</relativePath>
    </parent>
    <artifactId>agendamento</artifactId>
    <packaging>jar</packaging>

    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-jpa</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-security</artifactId>
        </dependency>

        <dependency>
            <groupId>org.springframework.cloud</groupId>
            <artifactId>spring-cloud-starter-openfeign</artifactId>
        </dependency>

        <dependency>
            <groupId>com.mysql</groupId>
            <artifactId>mysql-connector-j</artifactId>
            <scope>runtime</scope>
        </dependency>

        <dependency>
            <groupId>br.edu.imepac</groupId>
            <artifactId>commons</artifactId>
        </dependency>

        <dependency>
            <groupId>org.modelmapper</groupId>
            <artifactId>modelmapper</artifactId>
        </dependency>

        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <optional>true</optional>
        </dependency>

        <!-- Swagger -->
        <dependency>
            <groupId>org.springdoc</groupId>
            <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
            <version>3.0.3</version>
        </dependency>

        <!-- Logbook -->
        <dependency>
            <groupId>org.zalando</groupId>
            <artifactId>logbook-spring-boot-starter</artifactId>
            <version>4.0.4</version>
        </dependency>

        <!-- JWT -->
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

        <!-- Tests -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
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
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
        </plugins>
    </build>
</project>
```

---

## `application.yml`

```yaml
server:
  port: ${SERVER_PORT:8082}

spring:
  application:
    name: agendamento
  datasource:
    url: jdbc:mysql://${DB_HOST:localhost}:${DB_PORT:3308}/${DB_NAME:clinica_agendamento}?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=America/Sao_Paulo
    username: ${DB_USER:root}
    password: ${DB_PASSWORD:root}
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: ${JPA_SHOW_SQL:false}

# URL do administrativo para Feign
administrativo:
  url: ${ADMINISTRATIVO_URL:http://localhost:8081}

springdoc:
  swagger-ui:
    path: /swagger-ui.html

logbook:
  format:
    style: http

logging:
  level:
    br.edu.imepac: DEBUG
    org.zalando.logbook: TRACE

jwt:
  secret: ${JWT_SECRET:dev-secret-please-change-in-production-with-256-bits-minimum}
```

---

## `AgendamentoApplication`

```java
package br.edu.imepac.agendamento;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;

@SpringBootApplication(scanBasePackages = "br.edu.imepac")
@EnableFeignClients(basePackages = "br.edu.imepac.agendamento.client")
public class AgendamentoApplication {
    public static void main(String[] args) {
        SpringApplication.run(AgendamentoApplication.class, args);
    }
}
```

---

## Entidade

### `StatusAgendamento`

```java
package br.edu.imepac.agendamento.agendamento.enums;

public enum StatusAgendamento {
    AGENDADO,
    CONFIRMADO,
    CANCELADO,
    REALIZADO
}
```

### `AgendamentoEntity`

```java
package br.edu.imepac.agendamento.agendamento;

import br.edu.imepac.agendamento.agendamento.enums.StatusAgendamento;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "agendamentos",
       indexes = {
           @Index(name = "idx_agendamento_medico_data", columnList = "medicoId,dataHora"),
           @Index(name = "idx_agendamento_paciente",   columnList = "pacienteId")
       })
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AgendamentoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @Column(nullable = false)
    private Long pacienteId;

    @NotNull
    @Column(nullable = false)
    private Long medicoId;

    @NotNull
    @Future
    @Column(nullable = false)
    private LocalDateTime dataHora;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StatusAgendamento status;

    @Size(max = 500)
    @Column(length = 500)
    private String observacoes;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist void onCreate() {
        createdAt = updatedAt = LocalDateTime.now();
        if (status == null) status = StatusAgendamento.AGENDADO;
    }
    @PreUpdate void onUpdate() { updatedAt = LocalDateTime.now(); }
}
```

---

## DTOs

```java
// AgendamentoRequest.java
@Data @NoArgsConstructor @AllArgsConstructor
public class AgendamentoRequest {
    @NotNull private Long pacienteId;
    @NotNull private Long medicoId;
    @NotNull @Future private LocalDateTime dataHora;
    @Size(max = 500) private String observacoes;
}
```

```java
// AgendamentoUpdateRequest.java — cancelar / reagendar / confirmar
@Data @NoArgsConstructor @AllArgsConstructor
public class AgendamentoUpdateRequest {
    @Future private LocalDateTime dataHora;
    private StatusAgendamento status;
    private String observacoes;
}
```

```java
// AgendamentoResponse.java
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class AgendamentoResponse {
    private Long id;
    private Long pacienteId;
    private Long medicoId;
    private LocalDateTime dataHora;
    private StatusAgendamento status;
    private String observacoes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
```

---

## Repository

```java
package br.edu.imepac.agendamento.agendamento;

import br.edu.imepac.agendamento.agendamento.enums.StatusAgendamento;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface AgendamentoRepository extends JpaRepository<AgendamentoEntity, Long> {

    List<AgendamentoEntity> findByMedicoId(Long medicoId);

    List<AgendamentoEntity> findByPacienteId(Long pacienteId);

    boolean existsByMedicoIdAndDataHoraAndStatusIn(
        Long medicoId, LocalDateTime dataHora, List<StatusAgendamento> statuses);
}
```

---

## Feign client

### `AdministrativoClient`

```java
package br.edu.imepac.agendamento.client;

import br.edu.imepac.commons.dto.ExistsResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@FeignClient(name = "administrativo", url = "${administrativo.url}", configuration = FeignConfig.class)
public interface AdministrativoClient {

    @GetMapping("/v1/pacientes/{id}/exists")
    ExistsResponse pacienteExiste(@PathVariable Long id);

    @GetMapping("/v1/medicos/{id}/exists")
    ExistsResponse medicoExiste(@PathVariable Long id);
}
```

### `FeignConfig` com `ErrorDecoder`

```java
package br.edu.imepac.agendamento.client;

import br.edu.imepac.commons.exception.EntityNotFoundException;
import br.edu.imepac.commons.exception.FeignIntegrationException;
import feign.Response;
import feign.codec.ErrorDecoder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FeignConfig {

    @Bean
    public ErrorDecoder errorDecoder() {
        return (methodKey, response) -> switch (response.status()) {
            case 404 -> new EntityNotFoundException(
                "Recurso não encontrado em " + extractServiceName(methodKey));
            case 502, 503, 504 -> new FeignIntegrationException(
                extractServiceName(methodKey), "Serviço indisponível");
            default -> new FeignIntegrationException(
                extractServiceName(methodKey),
                "HTTP " + response.status());
        };
    }

    private String extractServiceName(String methodKey) {
        // methodKey vem como "AdministrativoClient#pacienteExiste(Long)"
        return methodKey.split("#")[0];
    }
}
```

> **Por que traduzir 404 em `EntityNotFoundException`?** Porque o `GlobalExceptionHandler` do commons já sabe traduzir essa exceção em `404 Bad Request` para o cliente final. Resultado: o erro do paciente inexistente vira HTTP 404 limpo, sem detalhes do Feign vazando.

---

## Service

```java
package br.edu.imepac.agendamento.agendamento;

import br.edu.imepac.agendamento.agendamento.dto.*;
import br.edu.imepac.agendamento.agendamento.enums.StatusAgendamento;
import br.edu.imepac.agendamento.client.AdministrativoClient;
import br.edu.imepac.commons.exception.BusinessException;
import br.edu.imepac.commons.exception.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class AgendamentoService {

    private final AgendamentoRepository repository;
    private final AdministrativoClient administrativoClient;
    private final ModelMapper modelMapper;

    private static final List<StatusAgendamento> ATIVOS =
        List.of(StatusAgendamento.AGENDADO, StatusAgendamento.CONFIRMADO);

    public AgendamentoResponse criar(AgendamentoRequest req) {
        validarPacienteExiste(req.getPacienteId());
        validarMedicoExiste(req.getMedicoId());
        validarHorarioLivre(req.getMedicoId(), req.getDataHora());

        AgendamentoEntity entity = modelMapper.map(req, AgendamentoEntity.class);
        entity.setStatus(StatusAgendamento.AGENDADO);
        AgendamentoEntity saved = repository.save(entity);
        log.info("Agendamento {} criado para paciente {} com médico {}", saved.getId(),
                 saved.getPacienteId(), saved.getMedicoId());
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<AgendamentoResponse> findAll() {
        return repository.findAll().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public AgendamentoResponse findById(Long id) {
        return toResponse(findEntity(id));
    }

    @Transactional(readOnly = true)
    public List<AgendamentoResponse> findByMedico(Long medicoId) {
        return repository.findByMedicoId(medicoId).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<AgendamentoResponse> findByPaciente(Long pacienteId) {
        return repository.findByPacienteId(pacienteId).stream().map(this::toResponse).toList();
    }

    public AgendamentoResponse atualizar(Long id, AgendamentoUpdateRequest req) {
        AgendamentoEntity entity = findEntity(id);
        if (entity.getStatus() == StatusAgendamento.REALIZADO ||
            entity.getStatus() == StatusAgendamento.CANCELADO) {
            throw new BusinessException("Agendamento " + entity.getStatus() + " não pode ser alterado");
        }
        if (req.getDataHora() != null) {
            validarHorarioLivre(entity.getMedicoId(), req.getDataHora());
            entity.setDataHora(req.getDataHora());
        }
        if (req.getStatus() != null) entity.setStatus(req.getStatus());
        if (req.getObservacoes() != null) entity.setObservacoes(req.getObservacoes());
        return toResponse(repository.save(entity));
    }

    public void cancelar(Long id) {
        AgendamentoEntity entity = findEntity(id);
        if (entity.getStatus() == StatusAgendamento.REALIZADO) {
            throw new BusinessException("Agendamento já realizado não pode ser cancelado");
        }
        entity.setStatus(StatusAgendamento.CANCELADO);
        repository.save(entity);
    }

    private void validarPacienteExiste(Long id) {
        if (!administrativoClient.pacienteExiste(id).exists()) {
            throw new EntityNotFoundException("Paciente", id);
        }
    }

    private void validarMedicoExiste(Long id) {
        if (!administrativoClient.medicoExiste(id).exists()) {
            throw new EntityNotFoundException("Médico", id);
        }
    }

    private void validarHorarioLivre(Long medicoId, java.time.LocalDateTime dataHora) {
        if (repository.existsByMedicoIdAndDataHoraAndStatusIn(medicoId, dataHora, ATIVOS)) {
            throw new BusinessException("Médico já tem agendamento ativo nesse horário");
        }
    }

    private AgendamentoEntity findEntity(Long id) {
        return repository.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Agendamento", id));
    }

    private AgendamentoResponse toResponse(AgendamentoEntity e) {
        return modelMapper.map(e, AgendamentoResponse.class);
    }
}
```

---

## Controller

```java
@RestController
@RequestMapping("/v1/agendamentos")
@RequiredArgsConstructor
@Tag(name = "Agendamento")
public class AgendamentoController {

    private final AgendamentoService service;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','RECEPCIONISTA')")
    public ResponseEntity<ApiResponse<AgendamentoResponse>> criar(
            @Valid @RequestBody AgendamentoRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Agendamento criado", service.criar(req)));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','RECEPCIONISTA')")
    public ResponseEntity<ApiResponse<List<AgendamentoResponse>>> findAll() {
        return ResponseEntity.ok(ApiResponse.success(service.findAll()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','RECEPCIONISTA','MEDICO','PACIENTE')")
    public ResponseEntity<ApiResponse<AgendamentoResponse>> findById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(service.findById(id)));
    }

    @GetMapping("/medico/{medicoId}")
    @PreAuthorize("hasAnyRole('ADMIN','RECEPCIONISTA','MEDICO')")
    public ResponseEntity<ApiResponse<List<AgendamentoResponse>>> findByMedico(
            @PathVariable Long medicoId) {
        return ResponseEntity.ok(ApiResponse.success(service.findByMedico(medicoId)));
    }

    @GetMapping("/paciente/{pacienteId}")
    @PreAuthorize("hasAnyRole('ADMIN','RECEPCIONISTA','PACIENTE')")
    public ResponseEntity<ApiResponse<List<AgendamentoResponse>>> findByPaciente(
            @PathVariable Long pacienteId) {
        return ResponseEntity.ok(ApiResponse.success(service.findByPaciente(pacienteId)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','RECEPCIONISTA')")
    public ResponseEntity<ApiResponse<AgendamentoResponse>> atualizar(
            @PathVariable Long id, @Valid @RequestBody AgendamentoUpdateRequest req) {
        return ResponseEntity.ok(ApiResponse.success("Atualizado", service.atualizar(id, req)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','RECEPCIONISTA','PACIENTE')")
    public ResponseEntity<Void> cancelar(@PathVariable Long id) {
        service.cancelar(id);
        return ResponseEntity.noContent().build();
    }
}
```

> **Endpoint para atendimento consumir via Feign:** `GET /v1/agendamentos/{id}` já é público para o atendimento. Não precisa criar `/exists` separado, mas se quiser padronizar, crie.

---

## Testes manuais

```bash
# Criar agendamento (assume Paciente 1 e Médico 1 existentes em administrativo)
curl -X POST http://localhost:8082/v1/agendamentos \
  -H "Content-Type: application/json" \
  -d '{
    "pacienteId": 1,
    "medicoId": 1,
    "dataHora": "2026-06-15T14:00:00",
    "observacoes": "Consulta de rotina"
  }'

# Tentar criar com paciente inexistente — deve retornar 404
curl -X POST http://localhost:8082/v1/agendamentos \
  -H "Content-Type: application/json" \
  -d '{"pacienteId":99999,"medicoId":1,"dataHora":"2026-06-15T15:00:00"}'

# Tentar criar com data passada — deve retornar 400
curl -X POST http://localhost:8082/v1/agendamentos \
  -H "Content-Type: application/json" \
  -d '{"pacienteId":1,"medicoId":1,"dataHora":"2020-01-01T10:00:00"}'

# Tentar conflito de horário — deve retornar 422
# (criar dois agendamentos com mesmo médico/horário)
```

---

## Cenários de erro esperados

| Situação | Status | Origem |
|---|---|---|
| `pacienteId` ou `medicoId` ausente | 400 | `@NotNull` na request |
| `dataHora` no passado | 400 | `@Future` na request |
| Paciente não existe | 404 | `ErrorDecoder` traduz 404 do Feign |
| `administrativo` fora do ar | 502 | `FeignIntegrationException` |
| Horário já ocupado | 422 | `BusinessException` no service |

---

## Checklist

- [ ] `pom.xml` com Feign + Web + JPA + commons + Logbook + Swagger
- [ ] `application.yml` com `administrativo.url` configurável
- [ ] `@EnableFeignClients` no Application
- [ ] `AdministrativoClient` interface
- [ ] `FeignConfig` com `ErrorDecoder`
- [ ] `AgendamentoEntity` + DTOs + Repository + Service + Controller
- [ ] Validações: paciente existe, médico existe, data futura, horário livre
- [ ] Banco `clinica_agendamento` criado pelo Hibernate
- [ ] Swagger em `http://localhost:8082/swagger-ui.html`

---

## Próximo passo

[`06-ATENDIMENTO.md`](06-ATENDIMENTO.md) — Atendimento + Feign para agendamento.
