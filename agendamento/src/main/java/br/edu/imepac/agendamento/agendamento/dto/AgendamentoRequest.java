package br.edu.imepac.agendamento.agendamento.dto;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AgendamentoRequest {

    @NotNull(message = "pacienteId é obrigatório")
    private Long pacienteId;

    @NotNull(message = "medicoId é obrigatório")
    private Long medicoId;

    @NotNull(message = "dataHora é obrigatória")
    @Future(message = "dataHora deve ser no futuro")
    private LocalDateTime dataHora;

    @Size(max = 500)
    private String observacoes;
}
