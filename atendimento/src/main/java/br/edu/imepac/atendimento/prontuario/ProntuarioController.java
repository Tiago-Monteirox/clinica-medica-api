package br.edu.imepac.atendimento.prontuario;

import br.edu.imepac.atendimento.prontuario.dto.FinalizarProntuarioRequest;
import br.edu.imepac.atendimento.prontuario.dto.HistoricoClinicoResponse;
import br.edu.imepac.atendimento.prontuario.dto.ProntuarioRequest;
import br.edu.imepac.atendimento.prontuario.dto.ProntuarioResponse;
import br.edu.imepac.commons.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Prontuários", description = "Prontuário clínico e histórico do paciente")
@RestController
@RequestMapping("/v1/prontuarios")
public class ProntuarioController {

    private final ProntuarioService service;

    public ProntuarioController(ProntuarioService service) {
        this.service = service;
    }

    @Operation(summary = "Buscar prontuário por atendimento")
    @PreAuthorize("hasAnyRole('ADMIN', 'MEDICO')")
    @GetMapping("/atendimento/{atendimentoId}")
    public ResponseEntity<ApiResponse<ProntuarioResponse>> findByAtendimento(
            @PathVariable("atendimentoId") Long atendimentoId) {
        return ResponseEntity.ok(ApiResponse.success(service.findByAtendimento(atendimentoId)));
    }

    @Operation(summary = "Criar ou atualizar rascunho do prontuário")
    @PreAuthorize("hasRole('MEDICO')")
    @PutMapping("/atendimento/{atendimentoId}")
    public ResponseEntity<ApiResponse<ProntuarioResponse>> salvarRascunho(
            @PathVariable("atendimentoId") Long atendimentoId,
            @Valid @RequestBody ProntuarioRequest request) {
        return ResponseEntity.ok(ApiResponse.success(service.salvarRascunho(atendimentoId, request)));
    }

    @Operation(summary = "Finalizar prontuário")
    @PreAuthorize("hasRole('MEDICO')")
    @PostMapping("/{id}/finalizar")
    public ResponseEntity<ApiResponse<ProntuarioResponse>> finalizar(
            @PathVariable("id") Long id,
            @Valid @RequestBody(required = false) FinalizarProntuarioRequest request) {
        return ResponseEntity.ok(ApiResponse.success(service.finalizar(id, request)));
    }

    @Operation(summary = "Listar histórico clínico de um paciente")
    @PreAuthorize("hasAnyRole('ADMIN', 'MEDICO')")
    @GetMapping("/paciente/{pacienteId}/historico")
    public ResponseEntity<ApiResponse<HistoricoClinicoResponse>> historicoPorPaciente(
            @PathVariable("pacienteId") Long pacienteId,
            @RequestParam(defaultValue = "false") boolean incluirRascunhos) {
        return ResponseEntity.ok(ApiResponse.success(service.historicoPorPaciente(pacienteId, incluirRascunhos)));
    }
}
