package br.edu.imepac.atendimento.atendimento.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AtendimentoRequest {

    @NotNull(message = "agendamentoId é obrigatório")
    private Long agendamentoId;

    @NotBlank(message = "diagnostico é obrigatório")
    private String diagnostico;

    @NotBlank(message = "prescricao é obrigatória")
    private String prescricao;

    private String observacoes;
}
