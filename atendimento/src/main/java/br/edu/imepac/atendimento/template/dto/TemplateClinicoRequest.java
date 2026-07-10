package br.edu.imepac.atendimento.template.dto;

import br.edu.imepac.atendimento.template.TipoTemplateClinico;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TemplateClinicoRequest {

    @NotBlank(message = "codigo é obrigatório")
    private String codigo;

    @NotBlank(message = "nome é obrigatório")
    private String nome;

    @NotNull(message = "tipo é obrigatório")
    private TipoTemplateClinico tipo;

    @NotBlank(message = "conteudoMarkdown é obrigatório")
    private String conteudoMarkdown;

    private String schemaJson;
}
