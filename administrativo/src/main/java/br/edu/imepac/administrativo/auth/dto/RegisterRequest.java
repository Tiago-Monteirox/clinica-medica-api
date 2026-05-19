package br.edu.imepac.administrativo.auth.dto;

import br.edu.imepac.administrativo.auth.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank String nome,
        @NotBlank @Email String email,
        @NotBlank @Size(min = 6) String senha,
        @NotNull Role role
) {}
