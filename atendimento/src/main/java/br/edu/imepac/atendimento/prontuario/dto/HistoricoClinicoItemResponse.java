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
public class HistoricoClinicoItemResponse {
    private Long prontuarioId;
    private Long atendimentoId;
    private Long agendamentoId;
    private Long pacienteId;
    private Long medicoId;
    private LocalDateTime dataAtendimento;
    private StatusProntuario status;
    private String resumo;
    private String diagnostico;
    private String conduta;
    private String prescricao;
}
