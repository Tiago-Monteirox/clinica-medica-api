package br.edu.imepac.commons.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "convenios")
public class ConvenioEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "O nome do convênio é obrigatório")
    @Column(nullable = false, length = 150)
    private String nome;

    @Column(length = 500)
    private String descricao;
}

