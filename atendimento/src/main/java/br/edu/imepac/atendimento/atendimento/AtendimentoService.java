package br.edu.imepac.atendimento.atendimento;

import br.edu.imepac.atendimento.atendimento.dto.AtendimentoRequest;
import br.edu.imepac.atendimento.atendimento.dto.AtendimentoResponse;
import br.edu.imepac.atendimento.atendimento.dto.AtendimentoUpdateRequest;
import br.edu.imepac.atendimento.client.AgendamentoClient;
import br.edu.imepac.atendimento.messaging.AtendimentoEventPublisher;
import br.edu.imepac.commons.exceptions.BusinessException;
import br.edu.imepac.commons.exceptions.EntityNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@Transactional
public class AtendimentoService {

    private final AtendimentoRepository repository;
    private final AgendamentoClient agendamentoClient;
    private final AtendimentoEventPublisher eventPublisher;

    public AtendimentoService(AtendimentoRepository repository,
                              AgendamentoClient agendamentoClient,
                              AtendimentoEventPublisher eventPublisher) {
        this.repository = repository;
        this.agendamentoClient = agendamentoClient;
        this.eventPublisher = eventPublisher;
    }

    public AtendimentoResponse registrar(AtendimentoRequest req) {
        log.info("Registrando atendimento para agendamento={}", req.getAgendamentoId());

        if (repository.existsByAgendamentoId(req.getAgendamentoId())) {
            log.warn("Atendimento duplicado para agendamento={}", req.getAgendamentoId());
            throw new BusinessException("Já existe atendimento para este agendamento");
        }

        var envelope = agendamentoClient.buscar(req.getAgendamentoId());
        if (envelope == null || envelope.getData() == null) {
            log.warn("Agendamento {} não encontrado no serviço de agendamento", req.getAgendamentoId());
            throw new EntityNotFoundException("Agendamento com id " + req.getAgendamentoId() + " não encontrado");
        }
        var snapshot = envelope.getData();

        String status = snapshot.status();
        if (!"AGENDADO".equals(status) && !"CONFIRMADO".equals(status)) {
            log.warn("Tentativa de atendimento em agendamento {} com status inválido: {}", req.getAgendamentoId(), status);
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
        log.info("Atendimento {} registrado (agendamento={}, paciente={}, médico={})",
                saved.getId(), saved.getAgendamentoId(), saved.getPacienteId(), saved.getMedicoId());

        // Publica evento assincrono — o agendamento vai atualizar o status para ATENDIDO
        eventPublisher.publicarAtendimentoRegistrado(saved);

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
