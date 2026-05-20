package br.edu.imepac.atendimento.atendimento;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "atendimentos",
        indexes = {
                @Index(name = "idx_atendimento_agendamento", columnList = "agendamentoId", unique = true),
                @Index(name = "idx_atendimento_paciente",    columnList = "pacienteId"),
                @Index(name = "idx_atendimento_medico",      columnList = "medicoId")
        })
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AtendimentoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long agendamentoId;

    @Column(nullable = false)
    private Long pacienteId;

    @Column(nullable = false)
    private Long medicoId;

    @Column(nullable = false)
    private LocalDateTime dataAtendimento;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String diagnostico;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String prescricao;

    @Column(columnDefinition = "TEXT")
    private String observacoes;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = updatedAt = LocalDateTime.now();
        if (dataAtendimento == null) dataAtendimento = LocalDateTime.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
