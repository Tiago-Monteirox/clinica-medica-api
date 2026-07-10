package br.edu.imepac.atendimento.template;

import br.edu.imepac.atendimento.template.dto.TemplateClinicoRequest;
import br.edu.imepac.atendimento.template.dto.TemplateClinicoResponse;
import br.edu.imepac.commons.exceptions.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

@Service
@Transactional
public class TemplateClinicoService {

    private final TemplateClinicoRepository repository;

    public TemplateClinicoService(TemplateClinicoRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<TemplateClinicoResponse> listarAtivos() {
        return repository.findByAtivoTrueOrderByTipoAscCodigoAscVersaoDesc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public TemplateClinicoResponse buscarAtivo(String codigo) {
        return toResponse(buscarAtivoEntity(codigo));
    }

    @Transactional(readOnly = true)
    public TemplateClinicoEntity buscarAtivoEntity(String codigo) {
        return repository.findFirstByCodigoAndAtivoTrueOrderByVersaoDesc(normalizarCodigo(codigo))
                .orElseThrow(() -> new EntityNotFoundException(
                        "Template clínico " + codigo + " não encontrado"));
    }

    public TemplateClinicoResponse criarNovaVersao(TemplateClinicoRequest request) {
        String codigo = normalizarCodigo(request.getCodigo());

        repository.findFirstByCodigoAndAtivoTrueOrderByVersaoDesc(codigo)
                .ifPresent(template -> {
                    template.setAtivo(false);
                    repository.save(template);
                });

        Integer proximaVersao = repository.findFirstByCodigoOrderByVersaoDesc(codigo)
                .map(template -> template.getVersao() + 1)
                .orElse(1);

        TemplateClinicoEntity entity = TemplateClinicoEntity.builder()
                .codigo(codigo)
                .nome(request.getNome())
                .tipo(request.getTipo())
                .versao(proximaVersao)
                .conteudoMarkdown(request.getConteudoMarkdown())
                .schemaJson(request.getSchemaJson())
                .ativo(true)
                .build();

        return toResponse(repository.save(entity));
    }

    private String normalizarCodigo(String codigo) {
        return codigo == null ? null : codigo.trim().toUpperCase(Locale.ROOT);
    }

    private TemplateClinicoResponse toResponse(TemplateClinicoEntity entity) {
        return TemplateClinicoResponse.builder()
                .id(entity.getId())
                .codigo(entity.getCodigo())
                .nome(entity.getNome())
                .tipo(entity.getTipo())
                .versao(entity.getVersao())
                .conteudoMarkdown(entity.getConteudoMarkdown())
                .schemaJson(entity.getSchemaJson())
                .ativo(entity.isAtivo())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
