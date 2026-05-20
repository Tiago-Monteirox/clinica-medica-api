package br.edu.imepac.agendamento.agendamento;

import br.edu.imepac.agendamento.agendamento.dto.AgendamentoRequest;
import br.edu.imepac.agendamento.agendamento.dto.AgendamentoResponse;
import br.edu.imepac.agendamento.agendamento.dto.AgendamentoUpdateRequest;
import br.edu.imepac.commons.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Agendamentos", description = "Gestão da agenda")
@RestController
@RequestMapping("/v1/agendamentos")
public class AgendamentoController {

    private final AgendamentoService service;

    public AgendamentoController(AgendamentoService service) {
        this.service = service;
    }

    @Operation(summary = "Criar agendamento")
    @PreAuthorize("hasAnyRole('ADMIN', 'RECEPCIONISTA')")
    @PostMapping
    public ResponseEntity<ApiResponse<AgendamentoResponse>> criar(@Valid @RequestBody AgendamentoRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(service.criar(req)));
    }

    @Operation(summary = "Listar agendamentos")
    @PreAuthorize("hasAnyRole('ADMIN', 'RECEPCIONISTA')")
    @GetMapping
    public ResponseEntity<ApiResponse<List<AgendamentoResponse>>> findAll() {
        return ResponseEntity.ok(ApiResponse.success(service.findAll()));
    }

    @Operation(summary = "Buscar agendamento por ID")
    @PreAuthorize("hasAnyRole('ADMIN', 'RECEPCIONISTA', 'MEDICO', 'PACIENTE')")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<AgendamentoResponse>> findById(@PathVariable("id") Long id) {
        return ResponseEntity.ok(ApiResponse.success(service.findById(id)));
    }

    @Operation(summary = "Listar agendamentos de um médico")
    @PreAuthorize("hasAnyRole('ADMIN', 'RECEPCIONISTA', 'MEDICO')")
    @GetMapping("/medico/{medicoId}")
    public ResponseEntity<ApiResponse<List<AgendamentoResponse>>> findByMedico(@PathVariable("medicoId") Long medicoId) {
        return ResponseEntity.ok(ApiResponse.success(service.findByMedico(medicoId)));
    }

    @Operation(summary = "Listar agendamentos de um paciente")
    @PreAuthorize("hasAnyRole('ADMIN', 'RECEPCIONISTA', 'PACIENTE')")
    @GetMapping("/paciente/{pacienteId}")
    public ResponseEntity<ApiResponse<List<AgendamentoResponse>>> findByPaciente(@PathVariable("pacienteId") Long pacienteId) {
        return ResponseEntity.ok(ApiResponse.success(service.findByPaciente(pacienteId)));
    }

    @Operation(summary = "Atualizar agendamento (reagendar / confirmar)")
    @PreAuthorize("hasAnyRole('ADMIN', 'RECEPCIONISTA')")
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<AgendamentoResponse>> atualizar(@PathVariable("id") Long id,
                                                                      @Valid @RequestBody AgendamentoUpdateRequest req) {
        return ResponseEntity.ok(ApiResponse.success(service.atualizar(id, req)));
    }

    @Operation(summary = "Cancelar agendamento")
    @PreAuthorize("hasAnyRole('ADMIN', 'RECEPCIONISTA', 'PACIENTE')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> cancelar(@PathVariable("id") Long id) {
        service.cancelar(id);
        return ResponseEntity.noContent().build();
    }
}
