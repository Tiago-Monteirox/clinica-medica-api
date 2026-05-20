package br.edu.imepac.atendimento.atendimento.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AtendimentoResponse {
    private Long id;
    private Long agendamentoId;
    private Long pacienteId;
    private Long medicoId;
    private LocalDateTime dataAtendimento;
    private String diagnostico;
    private String prescricao;
    private String observacoes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
