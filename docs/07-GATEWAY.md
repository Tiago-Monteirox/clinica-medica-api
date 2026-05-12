# 07 — API Gateway

> Spring Cloud Gateway. Porta **8080**. Tempo estimado: 2h.

## Papel do Gateway

1. **Porta única de entrada.** Os microsserviços ficam isolados; só o Gateway é exposto externamente.
2. **Roteamento por path.** `/api/admin/**` → administrativo; `/api/agendamentos/**` → agendamento; etc.
3. **Autenticação centralizada.** Filtro JWT valida o token antes de rotear (detalhes em [`08-SEGURANCA.md`](08-SEGURANCA.md)).
4. **Cross-cutting concerns.** Pode adicionar CORS, rate limiting, logging unificado, tracing.

> O Spring Cloud Gateway usa **WebFlux (reativo)**, não Spring MVC. Isso muda como você escreve filtros (usa `Mono`/`Flux`, não método síncrono).

---

## Estrutura

```
gateway/
├── pom.xml
└── src/main/
    ├── java/br/edu/imepac/gateway/
    │   ├── GatewayApplication.java
    │   ├── config/
    │   │   └── SecurityConfig.java
    │   └── security/
    │       ├── JwtAuthenticationFilter.java
    │       └── JwtUtil.java
    └── resources/
        └── application.yml
```

---

## Adicionar ao parent `pom.xml`

```xml
<modules>
    <module>commons</module>
    <module>administrativo</module>
    <module>agendamento</module>
    <module>atendimento</module>
    <module>gateway</module>      <!-- novo -->
</modules>
```

---

## `gateway/pom.xml`

```xml
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>br.edu.imepac</groupId>
        <artifactId>clinica-medica</artifactId>
        <version>1.0-SNAPSHOT</version>
        <relativePath>../pom.xml</relativePath>
    </parent>
    <artifactId>gateway</artifactId>
    <packaging>jar</packaging>

    <dependencies>
        <dependency>
            <groupId>org.springframework.cloud</groupId>
            <artifactId>spring-cloud-starter-gateway</artifactId>
        </dependency>

        <!-- Spring Security reativo (necessário para WebFlux) -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-security</artifactId>
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

        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <optional>true</optional>
        </dependency>

        <!-- Tests -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>io.projectreactor</groupId>
            <artifactId>reactor-test</artifactId>
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

> **Atenção:** o gateway **não** importa o `commons`. O commons usa Spring MVC (`@RestControllerAdvice`); o gateway usa WebFlux. Misturar quebra a auto-configuration. Se precisar de `ApiResponse` no gateway, redeclare local.

---

## `GatewayApplication`

```java
package br.edu.imepac.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class GatewayApplication {
    public static void main(String[] args) {
        SpringApplication.run(GatewayApplication.class, args);
    }
}
```

---

## `application.yml`

```yaml
server:
  port: ${SERVER_PORT:8080}

spring:
  application:
    name: gateway
  cloud:
    gateway:
      routes:
        # Login (público)
        - id: auth
          uri: ${ADMINISTRATIVO_URL:http://localhost:8081}
          predicates:
            - Path=/auth/**

        # Administrativo
        - id: administrativo
          uri: ${ADMINISTRATIVO_URL:http://localhost:8081}
          predicates:
            - Path=/api/admin/**
          filters:
            - StripPrefix=2          # remove /api/admin → /

        # Agendamento
        - id: agendamento
          uri: ${AGENDAMENTO_URL:http://localhost:8082}
          predicates:
            - Path=/api/agendamentos/**
          filters:
            - StripPrefix=2

        # Atendimento
        - id: atendimento
          uri: ${ATENDIMENTO_URL:http://localhost:8083}
          predicates:
            - Path=/api/atendimentos/**
          filters:
            - StripPrefix=2

        # Swagger UI por serviço (opcional, útil em dev)
        - id: swagger-administrativo
          uri: ${ADMINISTRATIVO_URL:http://localhost:8081}
          predicates:
            - Path=/docs/admin/**
          filters:
            - RewritePath=/docs/admin/(?<segment>.*), /$\{segment}

      default-filters:
        - DedupeResponseHeader=Access-Control-Allow-Origin Access-Control-Allow-Credentials, RETAIN_FIRST

      globalcors:
        cors-configurations:
          '[/**]':
            allowedOriginPatterns: "*"
            allowedMethods: "*"
            allowedHeaders: "*"
            allowCredentials: true

logging:
  level:
    org.springframework.cloud.gateway: INFO
    br.edu.imepac.gateway: DEBUG

jwt:
  secret: ${JWT_SECRET:dev-secret-please-change-in-production-with-256-bits-minimum}
```

> **Sobre `StripPrefix=2`:** se o cliente chama `/api/admin/v1/convenios`, o gateway encaminha para o backend como `/v1/convenios` (corta os 2 primeiros segmentos). Sem isso, o administrativo receberia `/api/admin/v1/convenios` e não acharia a rota.

---

## Como o Gateway funciona em runtime

```
Cliente → GET /api/admin/v1/convenios
       ↓
Gateway recebe na 8080
  ├─ Procura rota: predicate Path=/api/admin/** match!
  ├─ Aplica filtros: StripPrefix=2 → /v1/convenios
  ├─ JwtAuthenticationFilter valida token
  └─ Encaminha para http://administrativo:8081/v1/convenios

Backend responde
       ↓
Gateway repassa resposta ao cliente
```

---

## Roteamento + JWT integrado

A configuração de segurança fica em `SecurityConfig.java` (Spring Security WebFlux). Detalhes em [`08-SEGURANCA.md`](08-SEGURANCA.md), mas o esqueleto:

```java
@Configuration
@EnableWebFluxSecurity
public class SecurityConfig {

    @Bean
    public SecurityWebFilterChain securityFilterChain(ServerHttpSecurity http,
                                                       JwtAuthenticationFilter jwtFilter) {
        return http
            .csrf(ServerHttpSecurity.CsrfSpec::disable)
            .authorizeExchange(exchanges -> exchanges
                .pathMatchers("/auth/**", "/docs/**").permitAll()
                .anyExchange().authenticated()
            )
            .addFilterAt(jwtFilter, SecurityWebFiltersOrder.AUTHENTICATION)
            .build();
    }
}
```

---

## Verificação

```bash
mvn spring-boot:run -pl gateway
```

```bash
# Listar convênios via gateway (assume token válido)
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8080/api/admin/v1/convenios

# Login (rota pública)
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clinica.com","senha":"admin123"}'

# Requisição sem token em rota protegida — 401
curl -i http://localhost:8080/api/admin/v1/convenios
```

---

## Decisões e gotchas

### Por que rotas explícitas e não service discovery?

O exemplo do professor (e o IMPL_GUIDE_PT2) usam URLs configuráveis. Service discovery (Eureka, Consul) é overkill para 4 serviços. Se evoluir para 10+ serviços ou auto-scaling, vale revisar.

### Por que o gateway tem JWT separado dos microsserviços?

**Defesa em profundidade.** Se alguém vazar o IP de um microsserviço (`administrativo:8081` exposto por engano), ele continua exigindo JWT. O `JWT_SECRET` é compartilhado entre todos via env var.

### Sobre CORS

A configuração `globalcors` libera tudo (`*`). Em produção, restrinja para o domínio do frontend.

### Sobre rate limiting (evolução)

Spring Cloud Gateway tem `RequestRateLimiter` filter integrado com Redis. Não está no MVP.

---

## Checklist

- [ ] Módulo `gateway` adicionado ao parent `pom.xml`
- [ ] `gateway/pom.xml` com Spring Cloud Gateway + Security + JJWT
- [ ] `application.yml` com 4 rotas (auth, admin, agendamentos, atendimentos)
- [ ] `StripPrefix=2` em rotas /api/**
- [ ] CORS configurado
- [ ] `mvn spring-boot:run -pl gateway` sobe na 8080
- [ ] `curl http://localhost:8080/api/admin/v1/convenios` chega no administrativo

---

## Próximo passo

[`08-SEGURANCA.md`](08-SEGURANCA.md) — autenticação JWT ponta a ponta.
