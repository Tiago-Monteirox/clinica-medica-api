package br.edu.imepac.administrativo.medico;

import br.edu.imepac.administrativo.medico.dto.MedicoRequest;
import br.edu.imepac.administrativo.medico.dto.MedicoResponse;
import br.edu.imepac.administrativo.shared.dto.ExistsResponse;
import br.edu.imepac.commons.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.modelmapper.ModelMapper;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Médicos", description = "CRUD de médicos")
@RestController
@RequestMapping("/v1/medicos")
public class MedicoController {

    private final MedicoService medicoService;
    private final ModelMapper modelMapper;

    public MedicoController(MedicoService medicoService, ModelMapper modelMapper) {
        this.medicoService = medicoService;
        this.modelMapper = modelMapper;
    }

    @Operation(summary = "Listar todos os médicos")
    @PreAuthorize("hasAnyRole('ADMIN', 'RECEPCIONISTA', 'MEDICO')")
    @GetMapping
    public ResponseEntity<ApiResponse<List<MedicoResponse>>> findAll() {
        List<MedicoResponse> list = medicoService.findAll()
                .stream()
                .map(entity -> modelMapper.map(entity, MedicoResponse.class))
                .toList();
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @Operation(summary = "Buscar médico por ID")
    @PreAuthorize("hasAnyRole('ADMIN', 'RECEPCIONISTA', 'MEDICO')")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<MedicoResponse>> findById(@PathVariable Long id) {
        MedicoResponse response = modelMapper.map(medicoService.findById(id), MedicoResponse.class);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @Operation(summary = "Verificar se médico existe — endpoint interno para Feign")
    @GetMapping("/{id}/exists")
    public ResponseEntity<ExistsResponse> exists(@PathVariable Long id) {
        return ResponseEntity.ok(new ExistsResponse(medicoService.existsById(id)));
    }

    @Operation(summary = "Criar novo médico")
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ResponseEntity<ApiResponse<MedicoResponse>> create(@Valid @RequestBody MedicoRequest request) {
        MedicoEntity entity = modelMapper.map(request, MedicoEntity.class);
        MedicoResponse response = modelMapper.map(medicoService.save(entity), MedicoResponse.class);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    @Operation(summary = "Atualizar médico")
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<MedicoResponse>> update(@PathVariable Long id,
                                                              @Valid @RequestBody MedicoRequest request) {
        MedicoEntity entity = modelMapper.map(request, MedicoEntity.class);
        MedicoResponse response = modelMapper.map(medicoService.update(id, entity), MedicoResponse.class);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @Operation(summary = "Excluir médico")
    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        medicoService.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}