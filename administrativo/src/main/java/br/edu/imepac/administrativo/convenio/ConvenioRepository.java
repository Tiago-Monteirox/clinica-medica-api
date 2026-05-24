package br.edu.imepac.administrativo.convenio;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ConvenioRepository extends JpaRepository<ConvenioEntity, Long> {

    boolean existsByNome(String nome);
}
