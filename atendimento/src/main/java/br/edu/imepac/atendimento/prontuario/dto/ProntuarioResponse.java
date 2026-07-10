package br.edu.imepac.atendimento.prontuario.dto;

import br.edu.imepac.atendimento.prontuario.StatusProntuario;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProntuarioResponse {
    private Long id;
    private Long atendimentoId;
    private Long agendamentoId;
    private Long pacienteId;
    private Long medicoId;
    private LocalDateTime dataAtendimento;
    private String queixaPrincipal;
    private String historiaDoencaAtual;
    private String resumo;
    private String diagnostico;
    private String conduta;
    private String prescricao;
    private String observacoes;
    private StatusProntuario status;
    private LocalDateTime finalizadoEm;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
