package br.edu.imepac.atendimento.template;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "templates_clinicos",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_template_codigo_versao", columnNames = {"codigo", "versao"})
        },
        indexes = {
                @Index(name = "idx_template_codigo_ativo", columnList = "codigo,ativo")
        })
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TemplateClinicoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 80)
    private String codigo;

    @Column(nullable = false, length = 160)
    private String nome;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private TipoTemplateClinico tipo;

    @Column(nullable = false)
    private Integer versao;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String conteudoMarkdown;

    @Column(columnDefinition = "TEXT")
    private String schemaJson;

    @Column(nullable = false)
    private boolean ativo;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = updatedAt = LocalDateTime.now();
        if (versao == null) versao = 1;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
