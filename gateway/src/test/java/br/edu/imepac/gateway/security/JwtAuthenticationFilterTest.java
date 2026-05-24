package br.edu.imepac.gateway.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class JwtAuthenticationFilterTest {

    private static final String SECRET =
            "test-secret-com-256-bits-suficientes-para-hmac-sha-256-aaaaaaaaaaaaaaaaaa";

    private JwtUtil util;
    private JwtAuthenticationFilter filter;
    private SecretKey key;

    @BeforeEach
    void setUp() {
        util = new JwtUtil(SECRET);
        filter = new JwtAuthenticationFilter(util);
        key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
    }

    @Test
    void rotaPublicaPulaFilter() {
        var exchange = MockServerWebExchange.from(MockServerHttpRequest.get("/auth/login"));
        AtomicBoolean chainCalled = new AtomicBoolean(false);
        WebFilterChain chain = ex -> { chainCalled.set(true); return Mono.empty(); };

        filter.filter(exchange, chain).block();

        assertThat(chainCalled).isTrue();
        assertThat(exchange.getResponse().getStatusCode()).isNull();
    }

    @Test
    void actuatorHealthEhPublico() {
        var exchange = MockServerWebExchange.from(MockServerHttpRequest.get("/actuator/health"));
        AtomicBoolean chainCalled = new AtomicBoolean(false);
        WebFilterChain chain = ex -> { chainCalled.set(true); return Mono.empty(); };

        filter.filter(exchange, chain).block();

        assertThat(chainCalled).isTrue();
    }

    @Test
    void semHeaderAuthorizationRetorna401() {
        var exchange = MockServerWebExchange.from(MockServerHttpRequest.get("/api/admin/v1/convenios"));
        AtomicBoolean chainCalled = new AtomicBoolean(false);
        WebFilterChain chain = ex -> { chainCalled.set(true); return Mono.empty(); };

        filter.filter(exchange, chain).block();

        assertThat(chainCalled).as("chain não deve ser invocada quando rejeita").isFalse();
        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void headerSemPrefixoBearerRetorna401() {
        var exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/admin/v1/convenios")
                        .header(HttpHeaders.AUTHORIZATION, "Token abc.def.ghi"));
        WebFilterChain chain = ex -> Mono.empty();

        filter.filter(exchange, chain).block();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void tokenValidoPropagaHeadersDeUsuario() {
        String token = Jwts.builder()
                .subject("admin@clinica.com")
                .claim("role", "ADMIN")
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(key)
                .compact();

        var exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/admin/v1/convenios")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token));

        AtomicReference<HttpHeaders> capturado = new AtomicReference<>();
        WebFilterChain chain = ex -> {
            capturado.set(ex.getRequest().getHeaders());
            return Mono.empty();
        };

        filter.filter(exchange, chain).block();

        assertThat(exchange.getResponse().getStatusCode()).isNull();
        assertThat(capturado.get().getFirst("X-User-Email")).isEqualTo("admin@clinica.com");
        assertThat(capturado.get().getFirst("X-User-Role")).isEqualTo("ADMIN");
    }

    @Test
    void tokenInvalidoRetorna401() {
        var exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/admin/v1/convenios")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer nao-eh-um-jwt-valido"));
        WebFilterChain chain = ex -> Mono.empty();

        filter.filter(exchange, chain).block();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void getOrderRetornaMenosCem() {
        assertThat(filter.getOrder()).isEqualTo(-100);
    }
}
