package br.edu.imepac.administrativo.medico.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MedicoResponse {

    private Long id;
    private String nome;
    private String email;
    private String crm;
    private String especialidade;
    private String telefone;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}