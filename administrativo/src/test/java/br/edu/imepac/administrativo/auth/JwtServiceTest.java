package br.edu.imepac.administrativo.auth;

import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class JwtServiceTest {

    private static final String SECRET =
            "test-secret-com-256-bits-suficientes-para-hmac-sha-256-aaaaaaaaaaaaaaaaaa";

    private final JwtService service = new JwtService(SECRET, 60_000L);

    private final UsuarioEntity admin = UsuarioEntity.builder()
            .id(1L)
            .nome("Administrador")
            .email("admin@clinica.com")
            .senhaHash("ignorado-no-token")
            .role(Role.ADMIN)
            .build();

    @Test
    void generate_seguidoDeExtractAllClaims_devolveOsMesmosClaims() {
        String token = service.generate(admin);

        Claims claims = service.extractAllClaims(token);

        assertThat(claims.getSubject()).isEqualTo("admin@clinica.com");
        assertThat(claims.getIssuer()).isEqualTo("clinica-medica");
        assertThat(claims.get("role", String.class)).isEqualTo("ADMIN");
        assertThat(claims.get("uid", Long.class)).isEqualTo(1L);
        assertThat(claims.get("nome", String.class)).isEqualTo("Administrador");
        assertThat(claims.getIssuedAt()).isNotNull();
        assertThat(claims.getExpiration()).isAfter(claims.getIssuedAt());
        assertThat(claims.getId()).isNotBlank();
    }

    @Test
    void getExpirationMillis_retornaValorPassadoNoConstrutor() {
        assertThat(service.getExpirationMillis()).isEqualTo(60_000L);
    }

    @Test
    void generate_geraTokensDistintosParaUsuariosDiferentes() {
        var outro = UsuarioEntity.builder()
                .id(2L)
                .nome("Outro")
                .email("outro@x.com")
                .senhaHash("x")
                .role(Role.RECEPCIONISTA)
                .build();

        String t1 = service.generate(admin);
        String t2 = service.generate(outro);

        assertThat(t1).isNotEqualTo(t2);
        assertThat(service.extractAllClaims(t1).getSubject()).isEqualTo("admin@clinica.com");
        assertThat(service.extractAllClaims(t2).getSubject()).isEqualTo("outro@x.com");
    }
}
