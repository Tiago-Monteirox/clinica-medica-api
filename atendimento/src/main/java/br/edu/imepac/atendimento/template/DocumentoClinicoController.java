package br.edu.imepac.atendimento.template;

import br.edu.imepac.atendimento.template.dto.DocumentoClinicoRequest;
import br.edu.imepac.atendimento.template.dto.DocumentoClinicoResponse;
import br.edu.imepac.commons.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Documentos clínicos", description = "Preview e emissão de documentos por template")
@RestController
@RequestMapping("/v1/documentos-clinicos")
public class DocumentoClinicoController {

    private final DocumentoClinicoService service;

    public DocumentoClinicoController(DocumentoClinicoService service) {
        this.service = service;
    }

    @Operation(summary = "Renderizar documento clínico sem emitir")
    @PreAuthorize("hasRole('MEDICO')")
    @PostMapping("/preview")
    public ResponseEntity<ApiResponse<DocumentoClinicoResponse>> preview(
            @Valid @RequestBody DocumentoClinicoRequest request) {
        return ResponseEntity.ok(ApiResponse.success(service.preview(request)));
    }

    @Operation(summary = "Emitir documento clínico")
    @PreAuthorize("hasRole('MEDICO')")
    @PostMapping
    public ResponseEntity<ApiResponse<DocumentoClinicoResponse>> emitir(
            @Valid @RequestBody DocumentoClinicoRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(service.emitir(request)));
    }

    @Operation(summary = "Listar documentos de um prontuário")
    @PreAuthorize("hasAnyRole('ADMIN', 'MEDICO')")
    @GetMapping("/prontuario/{prontuarioId}")
    public ResponseEntity<ApiResponse<List<DocumentoClinicoResponse>>> findByProntuario(
            @PathVariable("prontuarioId") Long prontuarioId) {
        return ResponseEntity.ok(ApiResponse.success(service.findByProntuario(prontuarioId)));
    }
}
