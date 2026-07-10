package br.edu.imepac.atendimento.template;

import br.edu.imepac.atendimento.template.dto.TemplateClinicoRequest;
import br.edu.imepac.atendimento.template.dto.TemplateClinicoResponse;
import br.edu.imepac.commons.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Templates clínicos", description = "Templates versionados para documentos clínicos")
@RestController
@RequestMapping("/v1/templates-clinicos")
public class TemplateClinicoController {

    private final TemplateClinicoService service;

    public TemplateClinicoController(TemplateClinicoService service) {
        this.service = service;
    }

    @Operation(summary = "Listar templates clínicos ativos")
    @PreAuthorize("hasAnyRole('ADMIN', 'MEDICO')")
    @GetMapping
    public ResponseEntity<ApiResponse<List<TemplateClinicoResponse>>> listarAtivos() {
        return ResponseEntity.ok(ApiResponse.success(service.listarAtivos()));
    }

    @Operation(summary = "Buscar template clínico ativo por código")
    @PreAuthorize("hasAnyRole('ADMIN', 'MEDICO')")
    @GetMapping("/{codigo}")
    public ResponseEntity<ApiResponse<TemplateClinicoResponse>> buscarAtivo(@PathVariable("codigo") String codigo) {
        return ResponseEntity.ok(ApiResponse.success(service.buscarAtivo(codigo)));
    }

    @Operation(summary = "Criar nova versão de template clínico")
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ResponseEntity<ApiResponse<TemplateClinicoResponse>> criarNovaVersao(
            @Valid @RequestBody TemplateClinicoRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(service.criarNovaVersao(request)));
    }
}
