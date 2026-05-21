# 06 — Serviço `atendimento`

> Registro clínico do atendimento. Porta **8083**. Comunica com `agendamento` via Feign para validar agendamento. Tempo estimado: 2h.

## Pré-requisitos

- `agendamento` no ar com `GET /v1/agendamentos/{id}`.
- `commons` refatorado.
- BOM Spring Cloud no parent.

---

## Estrutura

```
atendimento/src/main/java/br/edu/imepac/atendimento/
├── AtendimentoApplication.java
├── client/
│   ├── AgendamentoClient.java
│   └── FeignConfig.java
├── atendimento/
│   ├── AtendimentoController.java
│   ├── AtendimentoService.java
│   ├── AtendimentoRepository.java
│   ├── AtendimentoEntity.java
│   └── dto/
│       ├── AtendimentoRequest.java
│       ├── AtendimentoUpdateRequest.java
│       └── AtendimentoResponse.java
└── security/    (filtro JWT — ver 08-SEGURANCA.md)
```

---

## `atendimento/pom.xml`

Idêntico ao do `agendamento` — copie e ajuste o `<artifactId>atendimento</artifactId>`.

---

## `application.yml`

```yaml
server:
  port: ${SERVER_PORT:8083}

spring:
  application:
    name: atendimento
  datasource:
    url: jdbc:mysql://${DB_HOST:localhost}:${DB_PORT:3309}/${DB_NAME:clinica_atendimento}?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=America/Sao_Paulo
    username: ${DB_USER:root}
    password: ${DB_PASSWORD:root}
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: ${JPA_SHOW_SQL:false}

agendamento:
  url: ${AGENDAMENTO_URL:http://localhost:8082}

springdoc:
  swagger-ui:
    path: /swagger-ui.html

logbook:
  format:
    style: http

logging:
  level:
    br.edu.imepac: DEBUG

jwt:
  secret: ${JWT_SECRET:dev-secret-please-change-in-production-with-256-bits-minimum}
```

---

## `AtendimentoApplication`

```java
@SpringBootApplication(scanBasePackages = "br.edu.imepac")
@EnableFeignClients(basePackages = "br.edu.imepac.atendimento.client")
public class AtendimentoApplication {
    public static void main(String[] args) {
        SpringApplication.run(AtendimentoApplication.class, args);
    }
}
```

---

## Entidade

```java
package br.edu.imepac.atendimento.atendimento;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "atendimentos",
       indexes = {
           @Index(name = "idx_atendimento_agendamento", columnList = "agendamentoId", unique = true),
           @Index(name = "idx_atendimento_paciente",    columnList = "pacienteId"),
           @Index(name = "idx_atendimento_medico",      columnList = "medicoId")
       })
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AtendimentoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @Column(nullable = false)
    private Long agendamentoId;

    @NotNull
    @Column(nullable = false)
    private Long pacienteId;

    @NotNull
    @Column(nullable = false)
    private Long medicoId;

    @NotNull
    @Column(nullable = false)
    private LocalDateTime dataAtendimento;

    @NotBlank
    @Column(nullable = false, columnDefinition = "TEXT")
    private String diagnostico;

    @NotBlank
    @Column(nullable = false, columnDefinition = "TEXT")
    private String prescricao;

    @Column(columnDefinition = "TEXT")
    private String observacoes;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist void onCreate() {
        createdAt = updatedAt = LocalDateTime.now();
        if (dataAtendimento == null) dataAtendimento = LocalDateTime.now();
    }
    @PreUpdate void onUpdate() { updatedAt = LocalDateTime.now(); }
}
```

> **Decisão:** `agendamentoId` é unique. Um agendamento gera no máximo um atendimento (regra de negócio). Se a clínica permitir múltiplos atendimentos por agendamento, retire o `unique = true`.
>
> **Por que `pacienteId` e `medicoId` denormalizados?** Para listar atendimentos de um paciente sem precisar chamar o `agendamento`. Trade-off: redundância em troca de performance e disponibilidade.

---

## DTOs

```java
@Data @NoArgsConstructor @AllArgsConstructor
public class AtendimentoRequest {
    @NotNull private Long agendamentoId;
    @NotBlank private String diagnostico;
    @NotBlank private String prescricao;
    private String observacoes;
}
```

```java
@Data @NoArgsConstructor @AllArgsConstructor
public class AtendimentoUpdateRequest {
    private String diagnostico;
    private String prescricao;
    private String observacoes;
}
```

```java
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class AtendimentoResponse {
    private Long id;
    private Long agendamentoId;
    private Long pacienteId;
    private Long medicoId;
    private LocalDateTime dataAtendimento;
    private String diagnostico;
    private String prescricao;
    private String observacoes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
```

---

## Repository

```java
public interface AtendimentoRepository extends JpaRepository<AtendimentoEntity, Long> {
    boolean existsByAgendamentoId(Long agendamentoId);
    List<AtendimentoEntity> findByPacienteId(Long pacienteId);
    List<AtendimentoEntity> findByMedicoId(Long medicoId);
}
```

---

## Feign client

### `AgendamentoClient`

```java
package br.edu.imepac.atendimento.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@FeignClient(name = "agendamento", url = "${agendamento.url}", configuration = FeignConfig.class)
public interface AgendamentoClient {

    @GetMapping("/v1/agendamentos/{id}")
    AgendamentoSnapshot buscar(@PathVariable Long id);

    /** Subset do AgendamentoResponse com os campos que o atendimento precisa. */
    record AgendamentoSnapshot(
        Long id,
        Long pacienteId,
        Long medicoId,
        java.time.LocalDateTime dataHora,
        String status
    ) {}
}
```

> **Por que um `record` aninhado e não importar `AgendamentoResponse`?** Porque `AgendamentoResponse` é detalhe interno do serviço `agendamento`. Se mudar lá, não queremos quebrar aqui. O snapshot define o **contrato mínimo** que o atendimento precisa.
>
> Note que o JSON do `agendamento` vem envelopado em `ApiResponse` — para simplificar, o client consome diretamente o body que `GET /{id}` retorna em `data`. Você tem 2 opções:
> 1. Fazer o client retornar `ApiResponse<AgendamentoSnapshot>` e extrair `data`.
> 2. Criar um endpoint `GET /v1/agendamentos/{id}/raw` no agendamento que retorna o snapshot direto sem envelope.
>
> A opção 1 é mais idiomática. Se for por essa, ajuste:
>
> ```java
> @GetMapping("/v1/agendamentos/{id}")
> ApiResponse<AgendamentoSnapshot> buscar(@PathVariable Long id);
> ```
>
> E no service: `client.buscar(id).getData()`.

### `FeignConfig`

Idêntico ao do agendamento (mesmo `ErrorDecoder`).

---

## Service

```java
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class AtendimentoService {

    private final AtendimentoRepository repository;
    private final AgendamentoClient agendamentoClient;
    private final ModelMapper modelMapper;

    public AtendimentoResponse registrar(AtendimentoRequest req) {
        if (repository.existsByAgendamentoId(req.getAgendamentoId())) {
            throw new BusinessException("Já existe atendimento para este agendamento");
        }
        // Busca agendamento via Feign — propaga 404 se não existir
        var agendamento = agendamentoClient.buscar(req.getAgendamentoId()).getData();
        if (agendamento == null) {
            throw new EntityNotFoundException("Agendamento", req.getAgendamentoId());
        }
        if (!"CONFIRMADO".equals(agendamento.status()) &&
            !"AGENDADO".equals(agendamento.status())) {
            throw new BusinessException("Agendamento não está em estado válido para atendimento (status atual: "
                + agendamento.status() + ")");
        }

        AtendimentoEntity entity = AtendimentoEntity.builder()
            .agendamentoId(req.getAgendamentoId())
            .pacienteId(agendamento.pacienteId())
            .medicoId(agendamento.medicoId())
            .dataAtendimento(LocalDateTime.now())
            .diagnostico(req.getDiagnostico())
            .prescricao(req.getPrescricao())
            .observacoes(req.getObservacoes())
            .build();

        var saved = repository.save(entity);
        log.info("Atendimento {} registrado (agendamento={})", saved.getId(), saved.getAgendamentoId());
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<AtendimentoResponse> findAll() {
        return repository.findAll().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public AtendimentoResponse findById(Long id) {
        return toResponse(findEntity(id));
    }

    @Transactional(readOnly = true)
    public List<AtendimentoResponse> findByPaciente(Long pacienteId) {
        return repository.findByPacienteId(pacienteId).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<AtendimentoResponse> findByMedico(Long medicoId) {
        return repository.findByMedicoId(medicoId).stream().map(this::toResponse).toList();
    }

    public AtendimentoResponse atualizar(Long id, AtendimentoUpdateRequest req) {
        AtendimentoEntity entity = findEntity(id);
        if (req.getDiagnostico() != null) entity.setDiagnostico(req.getDiagnostico());
        if (req.getPrescricao() != null) entity.setPrescricao(req.getPrescricao());
        if (req.getObservacoes() != null) entity.setObservacoes(req.getObservacoes());
        return toResponse(repository.save(entity));
    }

    public void delete(Long id) {
        if (!repository.existsById(id)) throw new EntityNotFoundException("Atendimento", id);
        repository.deleteById(id);
    }

    private AtendimentoEntity findEntity(Long id) {
        return repository.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Atendimento", id));
    }

    private AtendimentoResponse toResponse(AtendimentoEntity e) {
        return modelMapper.map(e, AtendimentoResponse.class);
    }
}
```

---

## Controller

```java
@RestController
@RequestMapping("/v1/atendimentos")
@RequiredArgsConstructor
@Tag(name = "Atendimento")
public class AtendimentoController {

    private final AtendimentoService service;

    @PostMapping
    @PreAuthorize("hasRole('MEDICO')")
    public ResponseEntity<ApiResponse<AtendimentoResponse>> registrar(
            @Valid @RequestBody AtendimentoRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Atendimento registrado", service.registrar(req)));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','MEDICO','RECEPCIONISTA')")
    public ResponseEntity<ApiResponse<List<AtendimentoResponse>>> findAll() {
        return ResponseEntity.ok(ApiResponse.success(service.findAll()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','MEDICO','RECEPCIONISTA')")
    public ResponseEntity<ApiResponse<AtendimentoResponse>> findById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(service.findById(id)));
    }

    @GetMapping("/paciente/{pacienteId}")
    @PreAuthorize("hasAnyRole('ADMIN','MEDICO','PACIENTE')")
    public ResponseEntity<ApiResponse<List<AtendimentoResponse>>> findByPaciente(
            @PathVariable Long pacienteId) {
        return ResponseEntity.ok(ApiResponse.success(service.findByPaciente(pacienteId)));
    }

    @GetMapping("/medico/{medicoId}")
    @PreAuthorize("hasAnyRole('ADMIN','MEDICO')")
    public ResponseEntity<ApiResponse<List<AtendimentoResponse>>> findByMedico(
            @PathVariable Long medicoId) {
        return ResponseEntity.ok(ApiResponse.success(service.findByMedico(medicoId)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('MEDICO')")
    public ResponseEntity<ApiResponse<AtendimentoResponse>> atualizar(
            @PathVariable Long id, @Valid @RequestBody AtendimentoUpdateRequest req) {
        return ResponseEntity.ok(ApiResponse.success("Atualizado", service.atualizar(id, req)));
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

## Testes manuais

```bash
# Registrar atendimento (assume agendamento 1 existente e CONFIRMADO)
curl -X POST http://localhost:8083/v1/atendimentos \
  -H "Content-Type: application/json" \
  -d '{
    "agendamentoId": 1,
    "diagnostico": "Hipertensão arterial estágio 1",
    "prescricao": "Losartana 50mg, 1x ao dia, 30 dias",
    "observacoes": "Reavaliar em 30 dias"
  }'

# Tentar registrar duplicado — 422
curl -X POST http://localhost:8083/v1/atendimentos \
  -H "Content-Type: application/json" \
  -d '{"agendamentoId":1,"diagnostico":"X","prescricao":"Y"}'

# Listar atendimentos do paciente 1
curl http://localhost:8083/v1/atendimentos/paciente/1
```

---

## Cenários de erro

| Situação | Status |
|---|---|
| `agendamentoId` não existe (Feign 404) | 404 |
| Agendamento já tem atendimento | 422 |
| Agendamento `CANCELADO` | 422 |
| `agendamento` fora do ar | 502 |
| `diagnostico` ou `prescricao` ausente | 400 |

---

## Checklist

- [ ] `pom.xml` igual ao do agendamento (com Feign)
- [ ] `application.yml` com `agendamento.url`
- [ ] `@EnableFeignClients` no Application
- [ ] `AgendamentoClient` consumindo `GET /v1/agendamentos/{id}`
- [ ] `AtendimentoEntity` com `agendamentoId` unique
- [ ] Service valida agendamento existente + status válido + sem duplicação
- [ ] Banco `clinica_atendimento` criado
- [ ] Swagger em `http://localhost:8083/swagger-ui.html`

---

## Próximo passo

[`07-GATEWAY.md`](07-GATEWAY.md) — API Gateway com Spring Cloud Gateway.
