# 08 — Segurança (JWT)

> Autenticação centralizada no Gateway + validação local em cada serviço. Tempo estimado: 4h.

## Visão geral

```
┌──────────────────────────────────────────────────────────────────┐
│  1. POST /auth/login                                             │
│     Cliente → Gateway → administrativo                           │
│     administrativo valida senha (BCrypt) e emite JWT              │
│     Resposta: { "token": "eyJ...", "expiresIn": 3600 }           │
├──────────────────────────────────────────────────────────────────┤
│  2. Cliente envia Authorization: Bearer eyJ...                   │
│     Gateway valida assinatura + expiração                        │
│     Gateway extrai roles do claim "roles"                        │
│     Bloqueia 401 se inválido                                     │
│     Encaminha para o backend com header X-User-Email             │
├──────────────────────────────────────────────────────────────────┤
│  3. Backend (administrativo/agendamento/atendimento)             │
│     Valida o mesmo JWT (defesa em profundidade)                  │
│     Spring Security popula SecurityContext                        │
│     @PreAuthorize("hasRole('ADMIN')") barra se role não bate     │
└──────────────────────────────────────────────────────────────────┘
```

**Decisão arquitetural:** os 4 serviços compartilham o mesmo `JWT_SECRET` via env var. Isso permite que cada um valide o token independentemente. Em produção, considerar par de chaves RSA (assinatura no administrativo, validação com chave pública nos demais).

---

## Roles

```java
public enum Role {
    ADMIN,           // Administrador da clínica
    RECEPCIONISTA,   // Cadastra pacientes, gerencia agendamentos
    MEDICO,          // Atende pacientes
    PACIENTE         // Consulta sua agenda e atendimentos
}
```

Spring Security espera o prefixo `ROLE_` no GrantedAuthority. Configurar para inserir automaticamente.

---

## Parte 1 — Emissão do token (`administrativo`)

### Tabela `usuarios`

```java
package br.edu.imepac.administrativo.auth;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "usuarios", uniqueConstraints = @UniqueConstraint(columnNames = "email"))
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class UsuarioEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150) private String nome;
    @Column(nullable = false, length = 200) private String email;
    @Column(nullable = false) private String senhaHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role;

    @Column(nullable = false, updatable = false) private LocalDateTime createdAt;
    @PrePersist void onCreate() { createdAt = LocalDateTime.now(); }
}
```

### Repository

```java
public interface UsuarioRepository extends JpaRepository<UsuarioEntity, Long> {
    Optional<UsuarioEntity> findByEmail(String email);
    boolean existsByEmail(String email);
}
```

### `JwtService` (geração)

```java
package br.edu.imepac.administrativo.auth;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;

@Service
public class JwtService {

    private final SecretKey key;
    private final long expirationMillis;

    public JwtService(@Value("${jwt.secret}") String secret,
                      @Value("${jwt.expiration:3600000}") long expirationMillis) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMillis = expirationMillis;
    }

    public String generate(UsuarioEntity user) {
        Date now = new Date();
        return Jwts.builder()
            .issuer("clinica-medica")
            .subject(user.getEmail())
            .claim("uid", user.getId())
            .claim("nome", user.getNome())
            .claim("role", user.getRole().name())
            .issuedAt(now)
            .expiration(new Date(now.getTime() + expirationMillis))
            .signWith(key)
            .compact();
    }

    public long getExpirationSeconds() {
        return expirationMillis / 1000;
    }
}
```

### `AuthService`

```java
@Service
@RequiredArgsConstructor
@Transactional
public class AuthService {

    private final UsuarioRepository repository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public LoginResponse login(LoginRequest req) {
        UsuarioEntity user = repository.findByEmail(req.email())
            .orElseThrow(() -> new BusinessException("Credenciais inválidas"));

        if (!passwordEncoder.matches(req.senha(), user.getSenhaHash())) {
            throw new BusinessException("Credenciais inválidas");
        }

        String token = jwtService.generate(user);
        return new LoginResponse(token, jwtService.getExpirationSeconds(),
                                 user.getEmail(), user.getRole());
    }

    public UsuarioResponse register(RegisterRequest req) {
        if (repository.existsByEmail(req.email())) {
            throw new BusinessException("E-mail já cadastrado");
        }
        UsuarioEntity user = UsuarioEntity.builder()
            .nome(req.nome())
            .email(req.email())
            .senhaHash(passwordEncoder.encode(req.senha()))
            .role(req.role())
            .build();
        return UsuarioResponse.from(repository.save(user));
    }
}
```

DTOs:

```java
public record LoginRequest(@NotBlank @Email String email, @NotBlank String senha) {}
public record LoginResponse(String token, long expiresIn, String email, Role role) {}
public record RegisterRequest(@NotBlank String nome,
                              @NotBlank @Email String email,
                              @NotBlank @Size(min = 8) String senha,
                              @NotNull Role role) {}
public record UsuarioResponse(Long id, String nome, String email, Role role) {
    static UsuarioResponse from(UsuarioEntity u) {
        return new UsuarioResponse(u.getId(), u.getNome(), u.getEmail(), u.getRole());
    }
}
```

### `AuthController`

```java
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
@Tag(name = "Autenticação")
public class AuthController {

    private final AuthService service;

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(@Valid @RequestBody LoginRequest req) {
        return ResponseEntity.ok(ApiResponse.success("Login bem-sucedido", service.login(req)));
    }

    @PostMapping("/register")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<UsuarioResponse>> register(@Valid @RequestBody RegisterRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ApiResponse.success("Usuário criado", service.register(req)));
    }
}
```

### Bean `PasswordEncoder`

Em qualquer `@Configuration` do administrativo (ou na própria `SecurityConfig` abaixo):

```java
@Bean
public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();
}
```

### Seed de dados (`CommandLineRunner`)

Para criar um admin inicial em dev:

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

---

## Parte 2 — Validação no Gateway (WebFlux)

### `JwtUtil` (compartilhado entre gateway e serviços, mas como gateway não importa commons, copie)

```java
package br.edu.imepac.gateway.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;

@Component
public class JwtUtil {

    private final SecretKey key;

    public JwtUtil(@Value("${jwt.secret}") String secret) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public Claims parse(String token) throws JwtException {
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    }
}
```

### `JwtAuthenticationFilter` (reativo)

```java
package br.edu.imepac.gateway.security;

import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter implements WebFilter {

    private final JwtUtil jwtUtil;

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();
        // Rotas públicas
        if (path.startsWith("/auth/") || path.startsWith("/docs/") || path.equals("/")) {
            return chain.filter(exchange);
        }

        String header = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (header == null || !header.startsWith("Bearer ")) {
            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
            return exchange.getResponse().setComplete();
        }

        String token = header.substring(7);
        try {
            Claims claims = jwtUtil.parse(token);
            String email = claims.getSubject();
            String role = claims.get("role", String.class);
            var auth = new UsernamePasswordAuthenticationToken(
                email, null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role))
            );

            // Propaga email e role como header para o backend (defesa em profundidade)
            ServerWebExchange mutated = exchange.mutate()
                .request(r -> r
                    .headers(h -> {
                        h.set("X-User-Email", email);
                        h.set("X-User-Role", role);
                    }))
                .build();

            return chain.filter(mutated)
                .contextWrite(ReactiveSecurityContextHolder.withAuthentication(auth));
        } catch (Exception e) {
            log.warn("JWT inválido: {}", e.getMessage());
            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
            return exchange.getResponse().setComplete();
        }
    }
}
```

### `SecurityConfig` (gateway)

```java
package br.edu.imepac.gateway.config;

import br.edu.imepac.gateway.security.JwtAuthenticationFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.SecurityWebFiltersOrder;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.web.server.SecurityWebFilterChain;

@Configuration
@EnableWebFluxSecurity
public class SecurityConfig {

    @Bean
    public SecurityWebFilterChain securityFilterChain(ServerHttpSecurity http,
                                                       JwtAuthenticationFilter jwtFilter) {
        return http
            .csrf(ServerHttpSecurity.CsrfSpec::disable)
            .httpBasic(ServerHttpSecurity.HttpBasicSpec::disable)
            .formLogin(ServerHttpSecurity.FormLoginSpec::disable)
            .authorizeExchange(ex -> ex
                .pathMatchers("/auth/**", "/docs/**", "/actuator/health").permitAll()
                .anyExchange().authenticated()
            )
            .addFilterAt(jwtFilter, SecurityWebFiltersOrder.AUTHENTICATION)
            .build();
    }
}
```

---

## Parte 3 — Validação local em cada microsserviço (Spring MVC)

Cada um (`administrativo`, `agendamento`, `atendimento`) precisa de:

1. Filtro JWT que popula o `SecurityContext`.
2. `SecurityFilterChain` que aplica o filtro e ativa `@PreAuthorize`.

### `JwtAuthFilter` (servlet)

```java
package br.edu.imepac.administrativo.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.crypto.SecretKey;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

@Slf4j
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
                String email = claims.getSubject();
                String role = claims.get("role", String.class);
                var auth = new UsernamePasswordAuthenticationToken(
                    email, null,
                    List.of(new SimpleGrantedAuthority("ROLE_" + role))
                );
                SecurityContextHolder.getContext().setAuthentication(auth);
            } catch (Exception e) {
                log.warn("JWT inválido: {}", e.getMessage());
            }
        }
        chain.doFilter(request, response);
    }
}
```

### `SecurityConfig` (servlet)

```java
package br.edu.imepac.administrativo.security;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableMethodSecurity     // habilita @PreAuthorize
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(
                    "/auth/login",
                    "/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html",
                    "/actuator/health",
                    "/v1/pacientes/*/exists", "/v1/medicos/*/exists"   // uso interno entre serviços
                ).permitAll()
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

### `SecurityConfig` para `agendamento` e `atendimento`

Igual ao do administrativo, **menos** as rotas `/auth/login` e `/exists` (eles não têm essas).

> **Atenção aos endpoints `/exists`:** estão liberados sem JWT porque são chamados **entre serviços via Feign**, e isolar por IP é mais robusto que passar token. Em produção, considere uma das opções:
> 1. Allow-list de IP (apenas a rede interna do Docker pode chamar).
> 2. Mutual TLS (mTLS) entre serviços.
> 3. Token de serviço (cada serviço tem um JWT próprio para chamadas internas).
>
> Para o MVP, deixar aberto e isolar pela network do Docker é aceitável.

---

## Parte 4 — Testando ponta a ponta

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clinica.com","senha":"admin123"}' \
  | jq -r '.data.token')

echo "TOKEN=$TOKEN"

# 2. Chamada autenticada via gateway
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8080/api/admin/v1/convenios

# 3. Sem token — esperado 401
curl -i http://localhost:8080/api/admin/v1/convenios

# 4. Token inválido — esperado 401
curl -i -H "Authorization: Bearer invalido" \
     http://localhost:8080/api/admin/v1/convenios

# 5. Role insuficiente — login como recepcionista, tentar DELETE convênio (só ADMIN)
# ... esperado 403 Forbidden
```

---

## Cenários de erro

| Situação | Status |
|---|---|
| Sem `Authorization` em rota privada | 401 |
| Token expirado | 401 |
| Assinatura inválida | 401 |
| Role insuficiente | 403 |
| Login com credenciais erradas | 422 (BusinessException) |

---

## Checklist

- [ ] Tabela `usuarios` em administrativo
- [ ] `Role` enum (ADMIN, RECEPCIONISTA, MEDICO, PACIENTE)
- [ ] `JwtService` (geração)
- [ ] `AuthService` + `AuthController` (`/auth/login`, `/auth/register`)
- [ ] Seed `admin@clinica.com` / `admin123`
- [ ] Gateway: `JwtAuthenticationFilter` (WebFilter reativo)
- [ ] Gateway: `SecurityConfig` (WebFlux) com rotas públicas
- [ ] Cada microsserviço: `JwtAuthFilter` (OncePerRequestFilter)
- [ ] Cada microsserviço: `SecurityConfig` com `@EnableMethodSecurity`
- [ ] `@PreAuthorize` nos controllers
- [ ] `JWT_SECRET` configurado via env var em todos os serviços
- [ ] Endpoints `/exists` e `/swagger-ui/**` excluídos da autenticação
- [ ] Testes: 401, 403, 422 cobertos

---

## Próximo passo

[`09-DOCKER.md`](09-DOCKER.md) — empacotar tudo em containers e subir com docker-compose.
