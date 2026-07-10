package br.edu.imepac.atendimento.prontuario;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProntuarioRepository extends JpaRepository<ProntuarioEntity, Long> {
    Optional<ProntuarioEntity> findByAtendimentoId(Long atendimentoId);
    List<ProntuarioEntity> findByPacienteIdOrderByDataAtendimentoDesc(Long pacienteId);
    List<ProntuarioEntity> findByPacienteIdAndStatusOrderByDataAtendimentoDesc(Long pacienteId, StatusProntuario status);
}
