package br.edu.imepac.administrativo.convenio;

import br.edu.imepac.commons.exceptions.EntityNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
public class ConvenioService {

    private final ConvenioRepository convenioRepository;

    public ConvenioService(ConvenioRepository convenioRepository) {
        this.convenioRepository = convenioRepository;
    }

    public List<ConvenioEntity> findAll() {
        return convenioRepository.findAll();
    }

    public ConvenioEntity findById(Long id) {
        return convenioRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Convênio não encontrado com id: " + id));
    }

    public ConvenioEntity save(ConvenioEntity convenio) {
        ConvenioEntity saved = convenioRepository.save(convenio);
        log.info("Convênio {} criado (id={})", saved.getNome(), saved.getId());
        return saved;
    }

    public ConvenioEntity update(Long id, ConvenioEntity dadosAtualizados) {
        ConvenioEntity existing = findById(id);
        existing.setNome(dadosAtualizados.getNome());
        existing.setDescricao(dadosAtualizados.getDescricao());
        ConvenioEntity saved = convenioRepository.save(existing);
        log.info("Convênio {} atualizado", saved.getId());
        return saved;
    }

    public void deleteById(Long id) {
        if (!convenioRepository.existsById(id)) {
            log.warn("Tentativa de remover convênio inexistente id={}", id);
            throw new EntityNotFoundException("Convênio não encontrado com id: " + id);
        }
        convenioRepository.deleteById(id);
        log.info("Convênio {} removido", id);
    }
}
