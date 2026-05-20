package br.edu.imepac.agendamento.agendamento.dto;

import br.edu.imepac.agendamento.agendamento.enums.StatusAgendamento;
import jakarta.validation.constraints.Future;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AgendamentoUpdateRequest {

    @Future(message = "dataHora deve ser no futuro")
    private LocalDateTime dataHora;

    private StatusAgendamento status;

    private String observacoes;
}
