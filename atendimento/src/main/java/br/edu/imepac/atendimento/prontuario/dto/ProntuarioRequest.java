package br.edu.imepac.atendimento.prontuario.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProntuarioRequest {
    private String queixaPrincipal;
    private String historiaDoencaAtual;
    private String resumo;
    private String diagnostico;
    private String conduta;
    private String prescricao;
    private String observacoes;
}
