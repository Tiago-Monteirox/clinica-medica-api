package br.edu.imepac.administrativo.auth;

import br.edu.imepac.administrativo.auth.dto.LoginRequest;
import br.edu.imepac.administrativo.auth.dto.LoginResponse;
import br.edu.imepac.administrativo.auth.dto.RegisterRequest;
import br.edu.imepac.administrativo.auth.dto.UsuarioResponse;
import br.edu.imepac.commons.exceptions.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock UsuarioRepository usuarioRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock JwtService jwtService;

    @InjectMocks AuthService service;

    private UsuarioEntity admin;

    @BeforeEach
    void setUp() {
        admin = UsuarioEntity.builder()
                .id(1L)
                .nome("Administrador")
                .email("admin@clinica.com")
                .senhaHash("$2a$10$hashbcryptdoadmin")
                .role(Role.ADMIN)
                .build();
    }

    @Test
    void login_credenciaisValidas_retornaLoginResponseComToken() {
        when(usuarioRepository.findByEmail("admin@clinica.com")).thenReturn(Optional.of(admin));
        when(passwordEncoder.matches("admin123", admin.getSenhaHash())).thenReturn(true);
        when(jwtService.generate(admin)).thenReturn("jwt.signed.token");
        when(jwtService.getExpirationMillis()).thenReturn(86_400_000L);

        LoginResponse resp = service.login(new LoginRequest("admin@clinica.com", "admin123"));

        assertThat(resp.token()).isEqualTo("jwt.signed.token");
        assertThat(resp.expiresInSeconds()).isEqualTo(86_400L);
        assertThat(resp.email()).isEqualTo("admin@clinica.com");
        assertThat(resp.role()).isEqualTo(Role.ADMIN);
    }

    @Test
    void login_emailNaoCadastrado_lancaBusinessException() {
        when(usuarioRepository.findByEmail("ninguem@x.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.login(new LoginRequest("ninguem@x.com", "qualquer")))
                .isInstanceOf(BusinessException.class)
                .hasMessage("Credenciais inválidas");
    }

    @Test
    void login_senhaErrada_lancaBusinessException() {
        when(usuarioRepository.findByEmail("admin@clinica.com")).thenReturn(Optional.of(admin));
        when(passwordEncoder.matches("senha-errada", admin.getSenhaHash())).thenReturn(false);

        assertThatThrownBy(() -> service.login(new LoginRequest("admin@clinica.com", "senha-errada")))
                .isInstanceOf(BusinessException.class)
                .hasMessage("Credenciais inválidas");
    }

    @Test
    void register_emailNovo_persisteERetornaUsuarioResponse() {
        var req = new RegisterRequest("Maria", "maria@x.com", "senha123", Role.RECEPCIONISTA);
        when(usuarioRepository.existsByEmail("maria@x.com")).thenReturn(false);
        when(passwordEncoder.encode("senha123")).thenReturn("$2a$10$mariahash");
        when(usuarioRepository.save(any(UsuarioEntity.class))).thenAnswer(inv -> {
            UsuarioEntity u = inv.getArgument(0);
            u.setId(42L);
            return u;
        });

        UsuarioResponse resp = service.register(req);

        assertThat(resp.id()).isEqualTo(42L);
        assertThat(resp.email()).isEqualTo("maria@x.com");
        assertThat(resp.nome()).isEqualTo("Maria");
        assertThat(resp.role()).isEqualTo(Role.RECEPCIONISTA);
    }

    @Test
    void findAll_retornaUsuariosSemSenhaHash() {
        var medico = UsuarioEntity.builder()
                .id(2L)
                .nome("Dra. Ana")
                .email("ana@clinica.com")
                .senhaHash("$2a$10$medicohash")
                .role(Role.MEDICO)
                .build();
        when(usuarioRepository.findAll()).thenReturn(List.of(admin, medico));

        List<UsuarioResponse> usuarios = service.findAll();

        assertThat(usuarios).hasSize(2);
        assertThat(usuarios)
                .extracting(UsuarioResponse::email)
                .containsExactly("admin@clinica.com", "ana@clinica.com");
        assertThat(usuarios.get(0).role()).isEqualTo(Role.ADMIN);
        assertThat(usuarios.get(1).role()).isEqualTo(Role.MEDICO);
    }

    @Test
    void register_emailJaCadastrado_lancaBusinessException() {
        var req = new RegisterRequest("Outra", "admin@clinica.com", "x", Role.ADMIN);
        when(usuarioRepository.existsByEmail("admin@clinica.com")).thenReturn(true);

        assertThatThrownBy(() -> service.register(req))
                .isInstanceOf(BusinessException.class)
                .hasMessage("E-mail já cadastrado");
    }
}
