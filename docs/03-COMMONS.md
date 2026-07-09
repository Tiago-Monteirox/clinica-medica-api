# 03 — Módulo `commons`

> Refatoração para biblioteca técnica pura. Tempo estimado: 2h.

## O que muda

| Antes | Depois |
|---|---|
| `commons` tem `ConvenioEntity`, `ConvenioRepository`, `ConvenioService` | Convênio sai do commons (vai para `administrativo`) |
| `commons` depende de `spring-boot-starter-data-jpa` | Não depende mais (não há entidades) |
| `commons` só tem `ModelMapperConfig` de utilitário | Ganha `ApiResponse`, `GlobalExceptionHandler`, exceções, DTOs de contrato, `DateUtils`, auto-configuration |

**Regra de ouro:** o commons não conhece o domínio da clínica. Ele oferece **infraestrutura técnica reutilizável**. Se um dia trocar de "clínica médica" para "loja de pet shop", o commons continua valendo.

---

## Estrutura final

```
commons/
├── pom.xml
└── src/main/
    ├── java/br/edu/imepac/commons/
    │   ├── config/
    │   │   ├── CommonsAutoConfiguration.java
    │   │   └── ModelMapperConfig.java
    │   ├── dto/
    │   │   ├── PacienteDTO.java       ← contrato compartilhado entre serviços
    │   │   ├── MedicoDTO.java
    │   │   └── ExistsResponse.java
    │   ├── exception/
    │   │   ├── BusinessException.java
    │   │   ├── EntityNotFoundException.java
    │   │   └── FeignIntegrationException.java
    │   ├── handler/
    │   │   └── GlobalExceptionHandler.java
    │   ├── response/
    │   │   └── ApiResponse.java
    │   └── util/
    │       └── DateUtils.java
    └── resources/
        └── META-INF/spring/
            └── org.springframework.boot.autoconfigure.AutoConfiguration.imports
```

---

## `commons/pom.xml`

```xml
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/maven-v4_0_0.xsd"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>br.edu.imepac</groupId>
        <artifactId>clinica-medica</artifactId>
        <version>1.0-SNAPSHOT</version>
        <relativePath>../pom.xml</relativePath>
    </parent>
    <artifactId>commons</artifactId>
    <packaging>jar</packaging>
    <name>commons</name>

    <dependencies>
        <!-- Spring Web: necessário para @RestControllerAdvice e ResponseEntity -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
            <scope>provided</scope>
        </dependency>
        <!-- Bean Validation: para usar @Valid e BindingResult no handler -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>
        <!-- ModelMapper -->
        <dependency>
            <groupId>org.modelmapper</groupId>
            <artifactId>modelmapper</artifactId>
        </dependency>
        <!-- Lombok -->
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <optional>true</optional>
        </dependency>
        <!-- Feign exceptions (para FeignIntegrationException) -->
        <dependency>
            <groupId>io.github.openfeign</groupId>
            <artifactId>feign-core</artifactId>
            <scope>provided</scope>
        </dependency>
        <!-- Testes -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>
</project>
```

> **Por que `spring-boot-starter-web` em `provided`?** Para o commons compilar (precisa das classes `@RestControllerAdvice`, `ResponseEntity`), mas sem forçar todos os consumidores a virar uma aplicação web. Quem usa o commons (como o `gateway`, que usa WebFlux) decide qual starter trazer.

---

## `ApiResponse<T>`

Envelope genérico para todas as respostas HTTP. Padroniza a estrutura JSON.

```java
package br.edu.imepac.commons.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {

    private boolean success;
    private String message;
    private T data;
    private List<String> errors;
    @Builder.Default
    private LocalDateTime timestamp = LocalDateTime.now();

    public static <T> ApiResponse<T> success(String message, T data) {
        return ApiResponse.<T>builder()
                .success(true)
                .message(message)
                .data(data)
                .build();
    }

    public static <T> ApiResponse<T> success(T data) {
        return success("OK", data);
    }

    public static <T> ApiResponse<T> error(String message, List<String> errors) {
        return ApiResponse.<T>builder()
                .success(false)
                .message(message)
                .errors(errors)
                .build();
    }

    public static <T> ApiResponse<T> error(String message) {
        return error(message, null);
    }
}
```

**Exemplo de payload:**

```json
{
  "success": true,
  "message": "Paciente criado com sucesso",
  "data": { "id": 1, "nome": "João", ... },
  "timestamp": "2026-05-07T20:30:00"
}
```

---

## Exceções base

### `BusinessException`

```java
package br.edu.imepac.commons.exception;

public class BusinessException extends RuntimeException {
    public BusinessException(String message) {
        super(message);
    }
}
```

Use quando uma regra de negócio for violada (HTTP 422).

### `EntityNotFoundException`

```java
package br.edu.imepac.commons.exception;

public class EntityNotFoundException extends RuntimeException {
    public EntityNotFoundException(String entity, Object id) {
        super(String.format("%s com id %s não encontrado", entity, id));
    }

    public EntityNotFoundException(String message) {
        super(message);
    }
}
```

HTTP 404.

### `FeignIntegrationException`

```java
package br.edu.imepac.commons.exception;

public class FeignIntegrationException extends RuntimeException {
    public FeignIntegrationException(String service, String message) {
        super(String.format("Falha ao chamar %s: %s", service, message));
    }
}
```

HTTP 502 — quando uma chamada Feign falha por motivo de infraestrutura (timeout, conexão recusada, 5xx).

---

## `GlobalExceptionHandler`

Centraliza o tratamento de exceções para qualquer microsserviço que importar o commons.

```java
package br.edu.imepac.commons.handler;

import br.edu.imepac.commons.exception.BusinessException;
import br.edu.imepac.commons.exception.EntityNotFoundException;
import br.edu.imepac.commons.exception.FeignIntegrationException;
import br.edu.imepac.commons.response.ApiResponse;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.List;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(EntityNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNotFound(EntityNotFoundException ex) {
        log.warn("Entidade não encontrada: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error(ex.getMessage()));
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusiness(BusinessException ex) {
        log.warn("Regra de negócio violada: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(ApiResponse.error(ex.getMessage()));
    }

    @ExceptionHandler(FeignIntegrationException.class)
    public ResponseEntity<ApiResponse<Void>> handleFeign(FeignIntegrationException ex) {
        log.error("Falha de integração: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(ApiResponse.error(ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException ex) {
        List<String> errors = ex.getBindingResult().getFieldErrors().stream()
                .map(this::formatFieldError)
                .toList();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error("Dados inválidos", errors));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleConstraint(ConstraintViolationException ex) {
        List<String> errors = ex.getConstraintViolations().stream()
                .map(v -> v.getPropertyPath() + ": " + v.getMessage())
                .toList();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error("Dados inválidos", errors));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGeneric(Exception ex) {
        log.error("Erro inesperado", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Erro interno do servidor"));
    }

    private String formatFieldError(FieldError err) {
        return err.getField() + ": " + err.getDefaultMessage();
    }
}
```

---

## DTOs de contrato compartilhado

Esses DTOs **trafegam entre serviços** via Feign. São o "contrato" — qualquer mudança quebra todos os clientes.

### `ExistsResponse`

```java
package br.edu.imepac.commons.dto;

public record ExistsResponse(boolean exists) {}
```

### `PacienteDTO`

```java
package br.edu.imepac.commons.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PacienteDTO {
    private Long id;
    private String nome;
    private String email;
    private String cpf;
}
```

### `MedicoDTO`

```java
package br.edu.imepac.commons.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MedicoDTO {
    private Long id;
    private String nome;
    private String crm;
    private String especialidade;
}
```

> **Não inclua `senha`, `convenio`, `dataNascimento` nesses DTOs.** Eles são contratos públicos entre serviços. Se mudar o que é exposto, você quebra os consumidores.

---

## `ModelMapperConfig` (já existe — manter)

```java
package br.edu.imepac.commons.config;

import org.modelmapper.ModelMapper;
import org.modelmapper.convention.MatchingStrategies;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ModelMapperConfig {

    @Bean
    public ModelMapper modelMapper() {
        ModelMapper mapper = new ModelMapper();
        mapper.getConfiguration().setMatchingStrategy(MatchingStrategies.STRICT);
        mapper.getConfiguration().setSkipNullEnabled(true);
        return mapper;
    }
}
```

---

## `CommonsAutoConfiguration`

Marca os pontos de configuração que serão registrados automaticamente no Spring Boot dos consumidores.

```java
package br.edu.imepac.commons.config;

import br.edu.imepac.commons.handler.GlobalExceptionHandler;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.context.annotation.Import;

@AutoConfiguration
@Import({
    GlobalExceptionHandler.class,
    ModelMapperConfig.class
})
public class CommonsAutoConfiguration {
}
```

E no arquivo `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`:

```
br.edu.imepac.commons.config.CommonsAutoConfiguration
```

> **O que isso significa?** Quando um microsserviço declara dependência do `commons`, o Spring Boot lê esse arquivo na fase de boot, instancia `CommonsAutoConfiguration`, e ela importa o handler e o ModelMapper sem precisar de `@ComponentScan` nos serviços. Padrão idiomático de bibliotecas Spring Boot 3+/4.x (substitui o antigo `spring.factories`).

---

## `DateUtils`

```java
package br.edu.imepac.commons.util;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

public final class DateUtils {

    public static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private DateUtils() {}

    public static String format(LocalDateTime dt) {
        return dt == null ? null : ISO.format(dt);
    }

    public static LocalDateTime parse(String s) {
        return s == null ? null : LocalDateTime.parse(s, ISO);
    }
}
```

---

## Verificação

Após implementar, rode:

```bash
mvn clean install -pl commons
```

Confirme:

1. Não há erros de compilação.
2. O JAR gerado **não é fat JAR**:
   ```bash
   jar tf commons/target/commons-*.jar | grep BOOT-INF
   # → não deve retornar nada
   ```
3. O JAR contém o `AutoConfiguration.imports`:
   ```bash
   jar tf commons/target/commons-*.jar | grep AutoConfiguration.imports
   # → META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
   ```

---

## Próximo passo

[`04-ADMINISTRATIVO.md`](04-ADMINISTRATIVO.md) — implementar Convênio (já existe, ajustar), Paciente e Médico.
