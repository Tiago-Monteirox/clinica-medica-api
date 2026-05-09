package br.edu.imepac.administrativo.controllers;

import br.edu.imepac.administrativo.dtos.ConvenioRequest;
import br.edu.imepac.administrativo.dtos.ConvenioResponse;
import br.edu.imepac.commons.entities.ConvenioEntity;
import br.edu.imepac.commons.services.ConvenioService;
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
    public ResponseEntity<List<ConvenioResponse>> findAll() {
        List<ConvenioResponse> response = convenioService.findAll()
                .stream()
                .map(entity -> modelMapper.map(entity, ConvenioResponse.class))
                .toList();
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ConvenioResponse> findById(@PathVariable Long id) {
        return convenioService.findById(id)
                .map(entity -> ResponseEntity.ok(modelMapper.map(entity, ConvenioResponse.class)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<ConvenioResponse> create(@Valid @RequestBody ConvenioRequest request) {
        ConvenioEntity entity = modelMapper.map(request, ConvenioEntity.class);
        ConvenioEntity saved = convenioService.save(entity);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(modelMapper.map(saved, ConvenioResponse.class));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ConvenioResponse> update(@PathVariable Long id,
                                                   @Valid @RequestBody ConvenioRequest request) {
        ConvenioEntity entity = modelMapper.map(request, ConvenioEntity.class);
        return convenioService.update(id, entity)
                .map(updated -> ResponseEntity.ok(modelMapper.map(updated, ConvenioResponse.class)))
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (convenioService.deleteById(id)) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}

