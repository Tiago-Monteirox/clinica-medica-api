package br.edu.imepac.administrativo.paciente.dto;

import br.edu.imepac.administrativo.convenio.dto.ConvenioResponse;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PacienteResponse {

    private Long id;
    private String nome;
    private String email;
    private String cpf;
    private String telefone;
    private LocalDate dataNascimento;
    private ConvenioResponse convenio;   // null se paciente não tem convênio
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}