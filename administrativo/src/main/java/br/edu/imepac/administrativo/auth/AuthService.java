package br.edu.imepac.administrativo.auth;

import br.edu.imepac.administrativo.auth.dto.LoginRequest;
import br.edu.imepac.administrativo.auth.dto.LoginResponse;
import br.edu.imepac.administrativo.auth.dto.RegisterRequest;
import br.edu.imepac.administrativo.auth.dto.UsuarioResponse;
import br.edu.imepac.commons.exceptions.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
public class AuthService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UsuarioRepository usuarioRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    public LoginResponse login(LoginRequest request) {
        log.info("Tentativa de login para {}", request.email());

        UsuarioEntity user = usuarioRepository.findByEmail(request.email())
                .orElseThrow(() -> {
                    log.warn("Login falhou: e-mail {} não cadastrado", request.email());
                    return new BusinessException("Credenciais inválidas");
                });

        if (!passwordEncoder.matches(request.senha(), user.getSenhaHash())) {
            log.warn("Login falhou: senha incorreta para {}", request.email());
            throw new BusinessException("Credenciais inválidas");
        }

        String token = jwtService.generate(user);
        long expiresInSeconds = jwtService.getExpirationMillis() / 1000;
        log.info("Login OK: usuário id={} role={}", user.getId(), user.getRole());

        return new LoginResponse(token, expiresInSeconds, user.getEmail(), user.getRole());
    }

    @Transactional(readOnly = true)
    public List<UsuarioResponse> findAll() {
        return usuarioRepository.findAll()
                .stream()
                .map(user -> new UsuarioResponse(user.getId(), user.getNome(), user.getEmail(), user.getRole()))
                .toList();
    }

    public UsuarioResponse register(RegisterRequest request) {
        log.info("Registrando novo usuário: email={} role={}", request.email(), request.role());

        if (usuarioRepository.existsByEmail(request.email())) {
            log.warn("Registro recusado: e-mail {} já cadastrado", request.email());
            throw new BusinessException("E-mail já cadastrado");
        }

        UsuarioEntity user = UsuarioEntity.builder()
                .nome(request.nome())
                .email(request.email())
                .senhaHash(passwordEncoder.encode(request.senha()))
                .role(request.role())
                .build();

        UsuarioEntity saved = usuarioRepository.save(user);
        log.info("Usuário {} registrado (id={})", saved.getEmail(), saved.getId());
        return new UsuarioResponse(saved.getId(), saved.getNome(), saved.getEmail(), saved.getRole());
    }
}
