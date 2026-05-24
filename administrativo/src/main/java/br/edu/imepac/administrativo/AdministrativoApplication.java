package br.edu.imepac.administrativo;

import br.edu.imepac.administrativo.auth.Role;
import br.edu.imepac.administrativo.auth.UsuarioEntity;
import br.edu.imepac.administrativo.auth.UsuarioRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;

@Slf4j
@SpringBootApplication
public class AdministrativoApplication {

    public static void main(String[] args) {
        SpringApplication.run(AdministrativoApplication.class, args);
    }

    @Bean
    @Profile("!test")   // não roda durante testes automatizados
    CommandLineRunner seedAdmin(UsuarioRepository repo, PasswordEncoder encoder) {
        return args -> {
            if (!repo.existsByEmail("admin@clinica.com")) {
                repo.save(UsuarioEntity.builder()
                        .nome("Administrador")
                        .email("admin@clinica.com")
                        .senhaHash(encoder.encode("admin123"))
                        .role(Role.ADMIN)
                        .build());
                log.info("Usuário admin seedado: admin@clinica.com (ADMIN)");
            } else {
                log.info("Usuário admin já existe — seed pulado");
            }
        };
    }
}