package br.edu.imepac.atendimento.template;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "documentos_clinicos",
        indexes = {
                @Index(name = "idx_documento_prontuario", columnList = "prontuarioId"),
                @Index(name = "idx_documento_paciente", columnList = "pacienteId"),
                @Index(name = "idx_documento_medico", columnList = "medicoId")
        })
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DocumentoClinicoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long prontuarioId;

    @Column(nullable = false)
    private Long pacienteId;

    @Column(nullable = false)
    private Long medicoId;

    @Column(nullable = false, length = 80)
    private String templateCodigo;

    @Column(nullable = false)
    private Integer templateVersao;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private TipoTemplateClinico tipo;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String conteudoMarkdown;

    @Column(columnDefinition = "MEDIUMTEXT")
    private String conteudoHtml;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StatusDocumentoClinico status;

    private LocalDateTime emitidoEm;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = updatedAt = LocalDateTime.now();
        if (status == null) status = StatusDocumentoClinico.RASCUNHO;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
