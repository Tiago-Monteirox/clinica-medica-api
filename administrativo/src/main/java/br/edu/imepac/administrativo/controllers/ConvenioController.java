package br.edu.imepac.administrativo.controllers;

import br.edu.imepac.administrativo.dtos.ConvenioRequest;
import br.edu.imepac.administrativo.dtos.ConvenioResponse;
import br.edu.imepac.administrativo.entities.ConvenioEntity;
import br.edu.imepac.administrativo.services.ConvenioService;
import br.edu.imepac.commons.dto.ApiResponse;
import jakarta.validation.Valid;
import org.modelmapper.ModelMapper;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/v1/convenios")
public class ConvenioController {

    private final ConvenioService convenioService;
    private final ModelMapper modelMapper;

    public ConvenioController(ConvenioService convenioService, ModelMapper modelMapper) {
        this.convenioService = convenioService;
        this.modelMapper = modelMapper;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<ConvenioResponse>>> findAll() {
        List<ConvenioResponse> list = convenioService.findAll()
                .stream()
                .map(entity -> modelMapper.map(entity, ConvenioResponse.class))
                .toList();
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ConvenioResponse>> findById(@PathVariable Long id) {
        ConvenioEntity entity = convenioService.findById(id);
        return ResponseEntity.ok(ApiResponse.success(modelMapper.map(entity, ConvenioResponse.class)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ConvenioResponse>> create(@Valid @RequestBody ConvenioRequest request) {
        ConvenioEntity entity = modelMapper.map(request, ConvenioEntity.class);
        ConvenioEntity saved = convenioService.save(entity);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(modelMapper.map(saved, ConvenioResponse.class)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<ConvenioResponse>> update(@PathVariable Long id,
                                                               @Valid @RequestBody ConvenioRequest request) {
        ConvenioEntity entity = modelMapper.map(request, ConvenioEntity.class);
        ConvenioEntity updated = convenioService.update(id, entity);
        return ResponseEntity.ok(ApiResponse.success(modelMapper.map(updated, ConvenioResponse.class)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        convenioService.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
