package br.edu.imepac.administrativo.paciente;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PacienteRepository extends JpaRepository<PacienteEntity, Long> {

    boolean existsByEmail(String email);

    boolean existsByCpf(String cpf);
}