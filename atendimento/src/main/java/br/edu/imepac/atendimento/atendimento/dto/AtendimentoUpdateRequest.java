package br.edu.imepac.atendimento.atendimento.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AtendimentoUpdateRequest {
    private String diagnostico;
    private String prescricao;
    private String observacoes;
}
