package br.edu.imepac.atendimento.prontuario.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class FinalizarProntuarioRequest {
    private String resumo;
}
