package br.edu.imepac.administrativo.medico;

import br.edu.imepac.commons.exceptions.BusinessException;
import br.edu.imepac.commons.exceptions.EntityNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

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
        if (medicoRepository.existsByEmail(medico.getEmail()))
            throw new BusinessException("E-mail já cadastrado");
        if (medicoRepository.existsByCrm(medico.getCrm()))
            throw new BusinessException("CRM já cadastrado");
        return medicoRepository.save(medico);
    }

    public MedicoEntity update(Long id, MedicoEntity dadosAtualizados) {
        MedicoEntity existing = findById(id);
        existing.setNome(dadosAtualizados.getNome());
        existing.setEspecialidade(dadosAtualizados.getEspecialidade());
        existing.setTelefone(dadosAtualizados.getTelefone());
        return medicoRepository.save(existing);
    }

    public void deleteById(Long id) {
        if (!medicoRepository.existsById(id))
            throw new EntityNotFoundException("Médico não encontrado com id: " + id);
        medicoRepository.deleteById(id);
    }
}