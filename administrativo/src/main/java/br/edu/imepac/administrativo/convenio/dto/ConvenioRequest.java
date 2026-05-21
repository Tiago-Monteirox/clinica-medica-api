package br.edu.imepac.administrativo.convenio.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ConvenioRequest {

    @NotBlank(message = "O nome do convênio é obrigatório")
    private String nome;
    private String descricao;
}

