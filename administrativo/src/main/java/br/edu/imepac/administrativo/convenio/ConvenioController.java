package br.edu.imepac.administrativo.convenio;

import br.edu.imepac.administrativo.convenio.dto.ConvenioRequest;
import br.edu.imepac.administrativo.convenio.dto.ConvenioResponse;
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

@Tag(name = "Convênios", description = "CRUD de convênios médicos")
@RestController
@RequestMapping("/v1/convenios")
public class ConvenioController {

    private final ConvenioService convenioService;
    private final ModelMapper modelMapper;

    public ConvenioController(ConvenioService convenioService, ModelMapper modelMapper) {
        this.convenioService = convenioService;
        this.modelMapper = modelMapper;
    }

    @Operation(summary = "Listar todos os convênios")
    @PreAuthorize("hasAnyRole('ADMIN', 'RECEPCIONISTA', 'MEDICO')")
    @GetMapping
    public ResponseEntity<ApiResponse<List<ConvenioResponse>>> findAll() {
        List<ConvenioResponse> list = convenioService.findAll()
                .stream()
                .map(entity -> modelMapper.map(entity, ConvenioResponse.class))
                .toList();
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @Operation(summary = "Buscar convênio por ID")
    @PreAuthorize("hasAnyRole('ADMIN', 'RECEPCIONISTA', 'MEDICO')")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ConvenioResponse>> findById(@PathVariable Long id) {
        ConvenioResponse response = modelMapper.map(convenioService.findById(id), ConvenioResponse.class);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @Operation(summary = "Criar novo convênio")
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ResponseEntity<ApiResponse<ConvenioResponse>> create(@Valid @RequestBody ConvenioRequest request) {
        ConvenioEntity entity = modelMapper.map(request, ConvenioEntity.class);
        ConvenioResponse response = modelMapper.map(convenioService.save(entity), ConvenioResponse.class);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    @Operation(summary = "Atualizar convênio")
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<ConvenioResponse>> update(@PathVariable Long id,
                                                               @Valid @RequestBody ConvenioRequest request) {
        ConvenioEntity entity = modelMapper.map(request, ConvenioEntity.class);
        ConvenioResponse response = modelMapper.map(convenioService.update(id, entity), ConvenioResponse.class);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @Operation(summary = "Excluir convênio")
    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        convenioService.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
