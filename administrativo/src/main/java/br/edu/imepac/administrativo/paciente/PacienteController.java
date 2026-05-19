package br.edu.imepac.administrativo.paciente;

import br.edu.imepac.administrativo.paciente.dto.PacienteRequest;
import br.edu.imepac.administrativo.paciente.dto.PacienteResponse;
import br.edu.imepac.administrativo.shared.dto.ExistsResponse;
import br.edu.imepac.commons.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.modelmapper.ModelMapper;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Pacientes", description = "CRUD de pacientes")
@RestController
@RequestMapping("/v1/pacientes")
public class PacienteController {

    private final PacienteService pacienteService;
    private final ModelMapper modelMapper;

    public PacienteController(PacienteService pacienteService, ModelMapper modelMapper) {
        this.pacienteService = pacienteService;
        this.modelMapper = modelMapper;
    }

    @Operation(summary = "Listar todos os pacientes")
    @GetMapping
    public ResponseEntity<ApiResponse<List<PacienteResponse>>> findAll() {
        List<PacienteResponse> list = pacienteService.findAll()
                .stream()
                .map(entity -> modelMapper.map(entity, PacienteResponse.class))
                .toList();
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @Operation(summary = "Buscar paciente por ID")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<PacienteResponse>> findById(@PathVariable Long id) {
        PacienteResponse response = modelMapper.map(pacienteService.findById(id), PacienteResponse.class);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @Operation(summary = "Verificar se paciente existe — endpoint interno para Feign")
    @GetMapping("/{id}/exists")
    public ResponseEntity<ExistsResponse> exists(@PathVariable Long id) {
        return ResponseEntity.ok(new ExistsResponse(pacienteService.existsById(id)));
    }

    @Operation(summary = "Criar novo paciente")
    @PostMapping
    public ResponseEntity<ApiResponse<PacienteResponse>> create(@Valid @RequestBody PacienteRequest request) {
        PacienteEntity entity = modelMapper.map(request, PacienteEntity.class);
        // convenioId é passado separado — o service resolve a FK
        PacienteEntity saved = pacienteService.save(entity, request.getConvenioId());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(modelMapper.map(saved, PacienteResponse.class)));
    }

    @Operation(summary = "Atualizar paciente")
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<PacienteResponse>> update(@PathVariable Long id,
                                                                @Valid @RequestBody PacienteRequest request) {
        PacienteEntity entity = modelMapper.map(request, PacienteEntity.class);
        PacienteEntity updated = pacienteService.update(id, entity, request.getConvenioId());
        return ResponseEntity.ok(ApiResponse.success(modelMapper.map(updated, PacienteResponse.class)));
    }

    @Operation(summary = "Excluir paciente")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        pacienteService.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}