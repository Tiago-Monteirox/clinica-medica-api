package br.edu.imepac.administrativo.auth;

import br.edu.imepac.administrativo.auth.dto.UsuarioResponse;
import br.edu.imepac.commons.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "Usuários", description = "Consulta de usuários da plataforma")
@RestController
@RequestMapping("/v1/usuarios")
public class UsuarioController {

    private final AuthService authService;

    public UsuarioController(AuthService authService) {
        this.authService = authService;
    }

    @Operation(summary = "Listar usuários cadastrados")
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping
    public ResponseEntity<ApiResponse<List<UsuarioResponse>>> findAll() {
        return ResponseEntity.ok(ApiResponse.success(authService.findAll()));
    }
}
