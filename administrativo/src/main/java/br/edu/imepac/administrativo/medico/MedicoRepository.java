package br.edu.imepac.administrativo.medico;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MedicoRepository extends JpaRepository<MedicoEntity, Long> {

    boolean existsByEmail(String email);

    boolean existsByCrm(String crm);
}