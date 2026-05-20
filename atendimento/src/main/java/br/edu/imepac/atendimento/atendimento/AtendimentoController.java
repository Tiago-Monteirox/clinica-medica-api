package br.edu.imepac.atendimento.atendimento;

import br.edu.imepac.atendimento.atendimento.dto.AtendimentoRequest;
import br.edu.imepac.atendimento.atendimento.dto.AtendimentoResponse;
import br.edu.imepac.atendimento.atendimento.dto.AtendimentoUpdateRequest;
import br.edu.imepac.commons.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Atendimentos", description = "Registro clínico do atendimento")
@RestController
@RequestMapping("/v1/atendimentos")
public class AtendimentoController {

    private final AtendimentoService service;

    public AtendimentoController(AtendimentoService service) {
        this.service = service;
    }

    @Operation(summary = "Registrar atendimento")
    @PreAuthorize("hasAnyRole('ADMIN', 'MEDICO')")
    @PostMapping
    public ResponseEntity<ApiResponse<AtendimentoResponse>> registrar(@Valid @RequestBody AtendimentoRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(service.registrar(req)));
    }

    @Operation(summary = "Listar atendimentos")
    @PreAuthorize("hasAnyRole('ADMIN', 'MEDICO', 'RECEPCIONISTA')")
    @GetMapping
    public ResponseEntity<ApiResponse<List<AtendimentoResponse>>> findAll() {
        return ResponseEntity.ok(ApiResponse.success(service.findAll()));
    }

    @Operation(summary = "Buscar atendimento por ID")
    @PreAuthorize("hasAnyRole('ADMIN', 'MEDICO', 'RECEPCIONISTA')")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<AtendimentoResponse>> findById(@PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.success(service.findById(id)));
    }

    @Operation(summary = "Listar atendimentos de um paciente")
    @PreAuthorize("hasAnyRole('ADMIN', 'MEDICO', 'PACIENTE')")
    @GetMapping("/paciente/{pacienteId}")
    public ResponseEntity<ApiResponse<List<AtendimentoResponse>>> findByPaciente(@PathVariable("pacienteId") Long pacienteId) {
        return ResponseEntity.ok(ApiResponse.success(service.findByPaciente(pacienteId)));
    }

    @Operation(summary = "Listar atendimentos de um médico")
    @PreAuthorize("hasAnyRole('ADMIN', 'MEDICO')")
    @GetMapping("/medico/{medicoId}")
    public ResponseEntity<ApiResponse<List<AtendimentoResponse>>> findByMedico(@PathVariable("medicoId") Long medicoId) {
        return ResponseEntity.ok(ApiResponse.success(service.findByMedico(medicoId)));
    }

    @Operation(summary = "Atualizar atendimento")
    @PreAuthorize("hasRole('MEDICO')")
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<AtendimentoResponse>> atualizar(@PathVariable("id") Long id,
                                                                      @Valid @RequestBody AtendimentoUpdateRequest req) {
        return ResponseEntity.ok(ApiResponse.success(service.atualizar(id, req)));
    }

    @Operation(summary = "Excluir atendimento")
    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable("id") Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
