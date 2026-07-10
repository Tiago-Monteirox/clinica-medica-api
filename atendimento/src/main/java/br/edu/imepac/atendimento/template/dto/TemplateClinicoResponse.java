package br.edu.imepac.atendimento.template.dto;

import br.edu.imepac.atendimento.template.TipoTemplateClinico;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TemplateClinicoResponse {
    private Long id;
    private String codigo;
    private String nome;
    private TipoTemplateClinico tipo;
    private Integer versao;
    private String conteudoMarkdown;
    private String schemaJson;
    private boolean ativo;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
