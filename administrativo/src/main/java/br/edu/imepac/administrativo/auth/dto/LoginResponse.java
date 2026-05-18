package br.edu.imepac.administrativo.auth.dto;

import br.edu.imepac.administrativo.auth.Role;

public record LoginResponse(
        String token,
        long expiresInSeconds,
        String email,
        Role role
) {}
