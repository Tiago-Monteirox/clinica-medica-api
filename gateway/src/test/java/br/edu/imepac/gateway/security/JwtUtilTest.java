package br.edu.imepac.gateway.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtUtilTest {

    private static final String SECRET =
            "test-secret-com-256-bits-suficientes-para-hmac-sha-256-aaaaaaaaaaaaaaaaaa";

    private final JwtUtil util = new JwtUtil(SECRET);
    private final SecretKey key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));

    @Test
    void parse_tokenValidoRetornaClaims() {
        String token = Jwts.builder()
                .subject("admin@clinica.com")
                .claim("role", "ADMIN")
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(key)
                .compact();

        Claims claims = util.parse(token);

        assertThat(claims.getSubject()).isEqualTo("admin@clinica.com");
        assertThat(claims.get("role", String.class)).isEqualTo("ADMIN");
    }

    @Test
    void parse_tokenExpiradoLancaJwtException() {
        String expirado = Jwts.builder()
                .subject("user@test.com")
                .issuedAt(new Date(System.currentTimeMillis() - 120_000))
                .expiration(new Date(System.currentTimeMillis() - 60_000))
                .signWith(key)
                .compact();

        assertThatThrownBy(() -> util.parse(expirado))
                .isInstanceOf(JwtException.class);
    }

    @Test
    void parse_tokenComAssinaturaInvalidaLancaJwtException() {
        // Token assinado com OUTRA chave — verificação tem que falhar
        String secretOutra = "outro-segredo-totalmente-diferente-mas-com-tamanho-suficiente-aaaaaa";
        SecretKey keyOutra = Keys.hmacShaKeyFor(secretOutra.getBytes(StandardCharsets.UTF_8));

        String token = Jwts.builder()
                .subject("intruso")
                .expiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(keyOutra)
                .compact();

        assertThatThrownBy(() -> util.parse(token))
                .isInstanceOf(JwtException.class);
    }

    @Test
    void parse_tokenMalformadoLancaJwtException() {
        assertThatThrownBy(() -> util.parse("isso.nao-eh.um-jwt-valido"))
                .isInstanceOf(JwtException.class);
    }

    @Test
    void parse_tokenVazioLancaExcecao() {
        // JJWT lança IllegalArgumentException pra string vazia (não é JwtException),
        // mas o comportamento é detectado e o filtro chama unauthorized() do mesmo jeito.
        assertThatThrownBy(() -> util.parse(""))
                .isInstanceOf(RuntimeException.class);
    }
}
