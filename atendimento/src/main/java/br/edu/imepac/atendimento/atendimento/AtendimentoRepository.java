package br.edu.imepac.atendimento.atendimento;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AtendimentoRepository extends JpaRepository<AtendimentoEntity, Long> {
    boolean existsByAgendamentoId(Long agendamentoId);
    List<AtendimentoEntity> findByPacienteId(Long pacienteId);
    List<AtendimentoEntity> findByMedicoId(Long medicoId);
}
