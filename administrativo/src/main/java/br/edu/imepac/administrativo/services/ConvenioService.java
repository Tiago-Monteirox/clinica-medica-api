package br.edu.imepac.administrativo.services;

import br.edu.imepac.administrativo.entities.ConvenioEntity;
import br.edu.imepac.administrativo.repositories.ConvenioRepository;
import br.edu.imepac.commons.exceptions.EntityNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

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
        return convenioRepository.save(convenio);
    }

    public ConvenioEntity update(Long id, ConvenioEntity dadosAtualizados) {
        ConvenioEntity existing = findById(id);
        existing.setNome(dadosAtualizados.getNome());
        existing.setDescricao(dadosAtualizados.getDescricao());
        return convenioRepository.save(existing);
    }

    public void deleteById(Long id) {
        if (!convenioRepository.existsById(id)) {
            throw new EntityNotFoundException("Convênio não encontrado com id: " + id);
        }
        convenioRepository.deleteById(id);
    }
}
