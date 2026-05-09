package br.edu.imepac.commons.services;

import br.edu.imepac.commons.entities.ConvenioEntity;
import br.edu.imepac.commons.repositories.ConvenioRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class ConvenioService {

    private final ConvenioRepository convenioRepository;

    public ConvenioService(ConvenioRepository convenioRepository) {
        this.convenioRepository = convenioRepository;
    }

    public List<ConvenioEntity> findAll() {
        return convenioRepository.findAll();
    }

    public Optional<ConvenioEntity> findById(Long id) {
        return convenioRepository.findById(id);
    }

    public ConvenioEntity save(ConvenioEntity convenio) {
        return convenioRepository.save(convenio);
    }

    public Optional<ConvenioEntity> update(Long id, ConvenioEntity dadosAtualizados) {
        return convenioRepository.findById(id).map(existing -> {
            existing.setNome(dadosAtualizados.getNome());
            existing.setDescricao(dadosAtualizados.getDescricao());
            return convenioRepository.save(existing);
        });
    }

    public boolean deleteById(Long id) {
        if (convenioRepository.existsById(id)) {
            convenioRepository.deleteById(id);
            return true;
        }
        return false;
    }
}

