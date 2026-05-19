package br.edu.imepac.administrativo.paciente;

import br.edu.imepac.administrativo.convenio.ConvenioEntity;
import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "pacientes", uniqueConstraints = {
        @UniqueConstraint(columnNames = "email"),
        @UniqueConstraint(columnNames = "cpf")
})
public class PacienteEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "O nome é obrigatório")
    @Size(max = 150)
    @Column(nullable = false, length = 150)
    private String nome;

    @NotBlank(message = "O e-mail é obrigatório")
    @Email(message = "E-mail inválido")
    @Column(nullable = false, length = 200)
    private String email;

    @NotBlank(message = "O CPF é obrigatório")
    @Size(min = 11, max = 11, message = "CPF deve ter 11 dígitos")
    @Column(nullable = false, length = 11)
    private String cpf;

    @Size(max = 20)
    @Column(length = 20)
    private String telefone;

    private LocalDate dataNascimento;

    // FK opcional: nem todo paciente tem convênio
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "convenio_id")   // sem nullable=false → permite NULL no banco
    private ConvenioEntity convenio;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() { createdAt = updatedAt = LocalDateTime.now(); }

    @PreUpdate
    void onUpdate() { updatedAt = LocalDateTime.now(); }
}