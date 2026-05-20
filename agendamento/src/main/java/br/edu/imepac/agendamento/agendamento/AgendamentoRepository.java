package br.edu.imepac.agendamento.agendamento;

import br.edu.imepac.agendamento.agendamento.enums.StatusAgendamento;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface AgendamentoRepository extends JpaRepository<AgendamentoEntity, Long> {

    List<AgendamentoEntity> findByMedicoId(Long medicoId);

    List<AgendamentoEntity> findByPacienteId(Long pacienteId);

    boolean existsByMedicoIdAndDataHoraAndStatusIn(
            Long medicoId, LocalDateTime dataHora, List<StatusAgendamento> statuses);
}
