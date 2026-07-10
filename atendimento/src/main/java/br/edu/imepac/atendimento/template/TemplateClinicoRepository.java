package br.edu.imepac.atendimento.template;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TemplateClinicoRepository extends JpaRepository<TemplateClinicoEntity, Long> {
    boolean existsByCodigoAndAtivoTrue(String codigo);
    Optional<TemplateClinicoEntity> findFirstByCodigoAndAtivoTrueOrderByVersaoDesc(String codigo);
    List<TemplateClinicoEntity> findByAtivoTrueOrderByTipoAscCodigoAscVersaoDesc();
    Optional<TemplateClinicoEntity> findFirstByCodigoOrderByVersaoDesc(String codigo);
}
