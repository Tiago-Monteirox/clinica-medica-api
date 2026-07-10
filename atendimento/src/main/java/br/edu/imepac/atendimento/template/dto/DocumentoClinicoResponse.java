package br.edu.imepac.atendimento.template.dto;

import br.edu.imepac.atendimento.template.StatusDocumentoClinico;
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
public class DocumentoClinicoResponse {
    private Long id;
    private Long prontuarioId;
    private Long pacienteId;
    private Long medicoId;
    private String templateCodigo;
    private Integer templateVersao;
    private TipoTemplateClinico tipo;
    private String conteudoMarkdown;
    private String conteudoHtml;
    private StatusDocumentoClinico status;
    private LocalDateTime emitidoEm;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
