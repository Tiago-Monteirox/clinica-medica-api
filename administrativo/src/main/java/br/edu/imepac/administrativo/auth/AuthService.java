package br.edu.imepac.administrativo.auth;

import br.edu.imepac.administrativo.auth.dto.LoginRequest;
import br.edu.imepac.administrativo.auth.dto.LoginResponse;
import br.edu.imepac.administrativo.auth.dto.RegisterRequest;
import br.edu.imepac.administrativo.auth.dto.UsuarioResponse;
import br.edu.imepac.commons.exceptions.BusinessException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

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
        UsuarioEntity user = usuarioRepository.findByEmail(request.email())
                .orElseThrow(() -> new BusinessException("Credenciais inválidas"));

        if (!passwordEncoder.matches(request.senha(), user.getSenhaHash())) {
            throw new BusinessException("Credenciais inválidas");
        }

        String token = jwtService.generate(user);
        long expiresInSeconds = jwtService.getExpirationMillis() / 1000;

        return new LoginResponse(token, expiresInSeconds, user.getEmail(), user.getRole());
    }

    public UsuarioResponse register(RegisterRequest request) {
        if (usuarioRepository.existsByEmail(request.email()))
            throw new BusinessException("E-mail já cadastrado");

        UsuarioEntity user = UsuarioEntity.builder()
                .nome(request.nome())
                .email(request.email())
                .senhaHash(passwordEncoder.encode(request.senha()))
                .role(request.role())
                .build();

        UsuarioEntity saved = usuarioRepository.save(user);
        return new UsuarioResponse(saved.getId(), saved.getNome(), saved.getEmail(), saved.getRole());
    }
}
