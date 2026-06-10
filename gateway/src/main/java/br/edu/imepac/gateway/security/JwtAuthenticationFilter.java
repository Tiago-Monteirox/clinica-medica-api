package br.edu.imepac.gateway.security;

import io.jsonwebtoken.Claims;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

@Slf4j
@Component
public class JwtAuthenticationFilter implements WebFilter, Ordered {

    private final JwtUtil jwtUtil;

    // Opcional — injetado apenas quando Redis esta no classpath/contexto.
    // Se o bean nao existir (sem Redis), a blacklist é ignorada.
    @Nullable
    private final JtiBlacklistService blacklistService;

    public JwtAuthenticationFilter(JwtUtil jwtUtil,
                                   @Autowired(required = false) JtiBlacklistService blacklistService) {
        this.jwtUtil = jwtUtil;
        this.blacklistService = blacklistService;
    }

    @Override
    public int getOrder() {
        return -100;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        // CORS preflight (OPTIONS) nunca carrega credenciais — exigir token aqui
        // bloqueia o browser de fazer a request real. O CorsWebFilter responde com
        // os headers Access-Control-* na sequência.
        if (HttpMethod.OPTIONS.equals(exchange.getRequest().getMethod())) {
            return chain.filter(exchange);
        }

        String path = exchange.getRequest().getURI().getPath();
        if (isPublic(path)) {
            return chain.filter(exchange);
        }

        String header = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (header == null || !header.startsWith("Bearer ")) {
            return unauthorized(exchange);
        }

        Claims claims;
        try {
            claims = jwtUtil.parse(header.substring(7));
        } catch (Exception e) {
            log.warn("JWT inválido: {}", e.getMessage());
            return unauthorized(exchange);
        }

        String jti = claims.getId();

        // Verifica blacklist se o servico estiver disponivel (Redis up).
        Mono<Boolean> blacklistCheck = (blacklistService != null && jti != null)
                ? blacklistService.estaRevogado(jti)
                        .doOnError(err -> log.warn("Erro ao verificar blacklist Redis (ignorando): {}", err.getMessage()))
                        .onErrorReturn(false)
                : Mono.just(false);

        String email = claims.getSubject();
        String role = claims.get("role", String.class);

        return blacklistCheck.flatMap(revogado -> {
            if (revogado) {
                log.warn("JWT revogado (jti={}, sub={})", jti, email);
                return unauthorized(exchange);
            }
            ServerWebExchange mutated = exchange.mutate()
                    .request(r -> r.headers(h -> {
                        h.set("X-User-Email", email);
                        h.set("X-User-Role", role);
                    }))
                    .build();
            return chain.filter(mutated);
        });
    }

    private boolean isPublic(String path) {
        // /auth/logout exige token valido para revogar o jti — nao entra no whitelist
        return (path.startsWith("/auth/") && !path.equals("/auth/logout"))
                || path.startsWith("/api/admin/v1/medicos/") && path.endsWith("/exists")
                || path.startsWith("/api/admin/v1/pacientes/") && path.endsWith("/exists")
                || path.startsWith("/actuator/health")
                || path.startsWith("/v3/api-docs")
                || path.startsWith("/swagger-ui");
    }

    private Mono<Void> unauthorized(ServerWebExchange exchange) {
        // Como cortamos a chain antes do CorsWebFilter aplicar os headers de CORS
        // na resposta, fetch() do browser bloqueia respostas 401 cross-origin com
        // "Failed to fetch" mesmo quando o backend efetivamente respondeu. Aplica
        // os headers manualmente — restritos a origens de desenvolvimento local
        // (mesmo padrão da allow-list em globalcors do application.yml).
        String origin = exchange.getRequest().getHeaders().getOrigin();
        if (isAllowedOrigin(origin)) {
            HttpHeaders responseHeaders = exchange.getResponse().getHeaders();
            responseHeaders.set("Access-Control-Allow-Origin", origin);
            responseHeaders.set("Access-Control-Allow-Credentials", "true");
            responseHeaders.add("Vary", "Origin");
        }
        exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
        return exchange.getResponse().setComplete();
    }

    private boolean isAllowedOrigin(String origin) {
        if (origin == null) return false;
        return origin.equals("http://localhost:5174")
                || origin.equals("http://127.0.0.1:5174")
                || origin.equals("http://localhost:8000")
                || origin.equals("http://127.0.0.1:8000")
                || origin.equals("http://localhost:5500")
                || origin.equals("http://127.0.0.1:5500");
    }
}
