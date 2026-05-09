package br.edu.imepac.administrativo.dtos;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ConvenioResponse {

    private Long id;
    private String nome;
    private String descricao;
}

