package br.edu.imepac.atendimento.template.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DocumentoClinicoRequest {

    @NotNull(message = "prontuarioId é obrigatório")
    private Long prontuarioId;

    @NotBlank(message = "templateCodigo é obrigatório")
    private String templateCodigo;

    private Map<String, Object> dadosComplementares;
}
