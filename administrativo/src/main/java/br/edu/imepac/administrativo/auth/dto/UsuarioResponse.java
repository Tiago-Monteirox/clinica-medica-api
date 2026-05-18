package br.edu.imepac.administrativo.auth.dto;

import br.edu.imepac.administrativo.auth.Role;

public record UsuarioResponse(
        Long id,
        String nome,
        String email,
        Role role
) {}
