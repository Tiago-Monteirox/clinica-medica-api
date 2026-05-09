package br.edu.imepac.administrativo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication(scanBasePackages = "br.edu.imepac")
@EntityScan(basePackages = "br.edu.imepac.commons.entities")
@EnableJpaRepositories(basePackages = "br.edu.imepac.commons.repositories")
public class AdministrativoApplication {

    public static void main(String[] args) {
        SpringApplication.run(AdministrativoApplication.class, args);
    }
}
