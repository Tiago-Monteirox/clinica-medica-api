package br.edu.imepac.atendimento.atendimento;

import br.edu.imepac.atendimento.atendimento.dto.AtendimentoRequest;
import br.edu.imepac.atendimento.atendimento.dto.AtendimentoResponse;
import br.edu.imepac.atendimento.atendimento.dto.AtendimentoUpdateRequest;
import br.edu.imepac.atendimento.client.AgendamentoClient;
import br.edu.imepac.commons.exceptions.BusinessException;
import br.edu.imepac.commons.exceptions.EntityNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@Transactional
public class AtendimentoService {

    private static final Logger log = LoggerFactory.getLogger(AtendimentoService.class);

    private final AtendimentoRepository repository;
    private final AgendamentoClient agendamentoClient;

    public AtendimentoService(AtendimentoRepository repository, AgendamentoClient agendamentoClient) {
        this.repository = repository;
        this.agendamentoClient = agendamentoClient;
    }

    public AtendimentoResponse registrar(AtendimentoRequest req) {
        if (repository.existsByAgendamentoId(req.getAgendamentoId())) {
            throw new BusinessException("Já existe atendimento para este agendamento");
        }

        var envelope = agendamentoClient.buscar(req.getAgendamentoId());
        if (envelope == null || envelope.getData() == null) {
            throw new EntityNotFoundException("Agendamento com id " + req.getAgendamentoId() + " não encontrado");
        }
        var snapshot = envelope.getData();

        String status = snapshot.status();
        if (!"AGENDADO".equals(status) && !"CONFIRMADO".equals(status)) {
            throw new BusinessException("Agendamento em status inválido para atendimento: " + status);
        }

        AtendimentoEntity entity = AtendimentoEntity.builder()
                .agendamentoId(req.getAgendamentoId())
                .pacienteId(snapshot.pacienteId())
                .medicoId(snapshot.medicoId())
                .dataAtendimento(LocalDateTime.now())
                .diagnostico(req.getDiagnostico())
                .prescricao(req.getPrescricao())
                .observacoes(req.getObservacoes())
                .build();
        var saved = repository.save(entity);
        log.info("Atendimento {} registrado (agendamento={})", saved.getId(), saved.getAgendamentoId());
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<AtendimentoResponse> findAll() {
        return repository.findAll().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public AtendimentoResponse findById(Long id) {
        return toResponse(findEntity(id));
    }

    @Transactional(readOnly = true)
    public List<AtendimentoResponse> findByPaciente(Long pacienteId) {
        return repository.findByPacienteId(pacienteId).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<AtendimentoResponse> findByMedico(Long medicoId) {
        return repository.findByMedicoId(medicoId).stream().map(this::toResponse).toList();
    }

    public AtendimentoResponse atualizar(Long id, AtendimentoUpdateRequest req) {
        AtendimentoEntity entity = findEntity(id);
        if (req.getDiagnostico() != null) entity.setDiagnostico(req.getDiagnostico());
        if (req.getPrescricao() != null) entity.setPrescricao(req.getPrescricao());
        if (req.getObservacoes() != null) entity.setObservacoes(req.getObservacoes());
        return toResponse(repository.save(entity));
    }

    public void delete(Long id) {
        if (!repository.existsById(id)) {
            throw new EntityNotFoundException("Atendimento com id " + id + " não encontrado");
        }
        repository.deleteById(id);
    }

    private AtendimentoEntity findEntity(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Atendimento com id " + id + " não encontrado"));
    }

    private AtendimentoResponse toResponse(AtendimentoEntity e) {
        return AtendimentoResponse.builder()
                .id(e.getId())
                .agendamentoId(e.getAgendamentoId())
                .pacienteId(e.getPacienteId())
                .medicoId(e.getMedicoId())
                .dataAtendimento(e.getDataAtendimento())
                .diagnostico(e.getDiagnostico())
                .prescricao(e.getPrescricao())
                .observacoes(e.getObservacoes())
                .createdAt(e.getCreatedAt())
                .updatedAt(e.getUpdatedAt())
                .build();
    }
}
