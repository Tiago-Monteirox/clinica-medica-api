package br.edu.imepac.atendimento.prontuario.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HistoricoClinicoResponse {
    private Long pacienteId;
    private boolean incluindoRascunhos;
    private List<HistoricoClinicoItemResponse> itens;
}
