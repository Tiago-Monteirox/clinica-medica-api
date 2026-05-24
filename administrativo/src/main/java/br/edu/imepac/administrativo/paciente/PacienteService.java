package br.edu.imepac.administrativo.paciente;

import br.edu.imepac.administrativo.convenio.ConvenioService;
import br.edu.imepac.commons.exceptions.BusinessException;
import br.edu.imepac.commons.exceptions.EntityNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
public class PacienteService {

    private final PacienteRepository pacienteRepository;
    private final ConvenioService convenioService;

    public PacienteService(PacienteRepository pacienteRepository, ConvenioService convenioService) {
        this.pacienteRepository = pacienteRepository;
        this.convenioService = convenioService;
    }

    public List<PacienteEntity> findAll() {
        return pacienteRepository.findAll();
    }

    public PacienteEntity findById(Long id) {
        return pacienteRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Paciente não encontrado com id: " + id));
    }

    public boolean existsById(Long id) {
        return pacienteRepository.existsById(id);
    }

    // convenioId é passado separado porque vem do Request (não da entidade)
    public PacienteEntity save(PacienteEntity paciente, Long convenioId) {
        if (pacienteRepository.existsByEmail(paciente.getEmail())) {
            log.warn("Cadastro de paciente recusado: e-mail {} já existe", paciente.getEmail());
            throw new BusinessException("E-mail já cadastrado");
        }
        if (pacienteRepository.existsByCpf(paciente.getCpf())) {
            log.warn("Cadastro de paciente recusado: CPF {} já existe", paciente.getCpf());
            throw new BusinessException("CPF já cadastrado");
        }

        // ConvenioService.findById lança EntityNotFoundException (404) se o ID não existir
        if (convenioId != null) {
            paciente.setConvenio(convenioService.findById(convenioId));
        }

        PacienteEntity saved = pacienteRepository.save(paciente);
        log.info("Paciente {} cadastrado (id={}, CPF={}, convenioId={})",
                saved.getNome(), saved.getId(), saved.getCpf(), convenioId);
        return saved;
    }

    public PacienteEntity update(Long id, PacienteEntity dadosAtualizados, Long convenioId) {
        PacienteEntity existing = findById(id);
        existing.setNome(dadosAtualizados.getNome());
        existing.setTelefone(dadosAtualizados.getTelefone());
        existing.setDataNascimento(dadosAtualizados.getDataNascimento());
        existing.setConvenio(convenioId != null ? convenioService.findById(convenioId) : null);
        PacienteEntity saved = pacienteRepository.save(existing);
        log.info("Paciente {} atualizado", saved.getId());
        return saved;
    }

    public void deleteById(Long id) {
        if (!pacienteRepository.existsById(id)) {
            log.warn("Tentativa de remover paciente inexistente id={}", id);
            throw new EntityNotFoundException("Paciente não encontrado com id: " + id);
        }
        pacienteRepository.deleteById(id);
        log.info("Paciente {} removido", id);
    }
}
