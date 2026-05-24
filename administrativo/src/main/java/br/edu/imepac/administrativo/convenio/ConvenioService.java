package br.edu.imepac.administrativo.convenio;

import br.edu.imepac.commons.exceptions.BusinessException;
import br.edu.imepac.commons.exceptions.EntityNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Objects;

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
        // Pré-valida o unique do schema (uq_convenios_nome) pra devolver 422 com
        // mensagem clara em vez de vazar SQLIntegrityConstraintViolationException
        // como 500 via handleGeneral.
        if (convenioRepository.existsByNome(convenio.getNome())) {
            log.warn("Cadastro de convênio recusado: nome '{}' já existe", convenio.getNome());
            throw new BusinessException("Convênio com nome '" + convenio.getNome() + "' já existe");
        }
        ConvenioEntity saved = convenioRepository.save(convenio);
        log.info("Convênio {} criado (id={})", saved.getNome(), saved.getId());
        return saved;
    }

    public ConvenioEntity update(Long id, ConvenioEntity dadosAtualizados) {
        ConvenioEntity existing = findById(id);
        // Se o nome mudou, garante que o novo nome não pertence a outro registro.
        if (!Objects.equals(existing.getNome(), dadosAtualizados.getNome())
                && convenioRepository.existsByNome(dadosAtualizados.getNome())) {
            log.warn("Atualização de convênio {} recusada: nome '{}' já existe em outro registro",
                    id, dadosAtualizados.getNome());
            throw new BusinessException("Convênio com nome '" + dadosAtualizados.getNome() + "' já existe");
        }
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
