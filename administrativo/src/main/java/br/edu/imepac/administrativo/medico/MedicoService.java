package br.edu.imepac.administrativo.medico;

import br.edu.imepac.commons.exceptions.BusinessException;
import br.edu.imepac.commons.exceptions.EntityNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
public class MedicoService {

    private final MedicoRepository medicoRepository;

    public MedicoService(MedicoRepository medicoRepository) {
        this.medicoRepository = medicoRepository;
    }

    public List<MedicoEntity> findAll() {
        return medicoRepository.findAll();
    }

    public MedicoEntity findById(Long id) {
        return medicoRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Médico não encontrado com id: " + id));
    }

    public boolean existsById(Long id) {
        return medicoRepository.existsById(id);
    }

    public MedicoEntity save(MedicoEntity medico) {
        if (medicoRepository.existsByEmail(medico.getEmail())) {
            log.warn("Cadastro de médico recusado: e-mail {} já existe", medico.getEmail());
            throw new BusinessException("E-mail já cadastrado");
        }
        if (medicoRepository.existsByCrm(medico.getCrm())) {
            log.warn("Cadastro de médico recusado: CRM {} já existe", medico.getCrm());
            throw new BusinessException("CRM já cadastrado");
        }
        MedicoEntity saved = medicoRepository.save(medico);
        log.info("Médico {} cadastrado (id={}, CRM={})", saved.getNome(), saved.getId(), saved.getCrm());
        return saved;
    }

    public MedicoEntity update(Long id, MedicoEntity dadosAtualizados) {
        MedicoEntity existing = findById(id);
        existing.setNome(dadosAtualizados.getNome());
        existing.setEspecialidade(dadosAtualizados.getEspecialidade());
        existing.setTelefone(dadosAtualizados.getTelefone());
        MedicoEntity saved = medicoRepository.save(existing);
        log.info("Médico {} atualizado", saved.getId());
        return saved;
    }

    public void deleteById(Long id) {
        if (!medicoRepository.existsById(id)) {
            log.warn("Tentativa de remover médico inexistente id={}", id);
            throw new EntityNotFoundException("Médico não encontrado com id: " + id);
        }
        medicoRepository.deleteById(id);
        log.info("Médico {} removido", id);
    }
}
