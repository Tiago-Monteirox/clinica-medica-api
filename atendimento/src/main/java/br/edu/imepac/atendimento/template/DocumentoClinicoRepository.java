package br.edu.imepac.atendimento.template;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DocumentoClinicoRepository extends JpaRepository<DocumentoClinicoEntity, Long> {
    List<DocumentoClinicoEntity> findByProntuarioIdOrderByCreatedAtDesc(Long prontuarioId);
}
