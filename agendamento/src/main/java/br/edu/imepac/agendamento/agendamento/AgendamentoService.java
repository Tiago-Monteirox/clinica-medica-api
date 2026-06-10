package br.edu.imepac.agendamento.agendamento;

import br.edu.imepac.agendamento.agendamento.dto.AgendamentoRequest;
import br.edu.imepac.agendamento.agendamento.dto.AgendamentoResponse;
import br.edu.imepac.agendamento.agendamento.dto.AgendamentoUpdateRequest;
import br.edu.imepac.agendamento.agendamento.enums.StatusAgendamento;
import br.edu.imepac.agendamento.client.AdministrativoLookupService;
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
public class AgendamentoService {

    private static final List<StatusAgendamento> ATIVOS =
            List.of(StatusAgendamento.AGENDADO, StatusAgendamento.CONFIRMADO);

    private final AgendamentoRepository repository;
    private final AdministrativoLookupService lookupService;

    public AgendamentoService(AgendamentoRepository repository,
                              AdministrativoLookupService lookupService) {
        this.repository = repository;
        this.lookupService = lookupService;
    }

    public AgendamentoResponse criar(AgendamentoRequest req) {
        log.info("Criando agendamento para paciente={} médico={} dataHora={}",
                req.getPacienteId(), req.getMedicoId(), req.getDataHora());

        validarPacienteExiste(req.getPacienteId());
        validarMedicoExiste(req.getMedicoId());
        validarHorarioLivre(req.getMedicoId(), req.getDataHora());

        AgendamentoEntity entity = AgendamentoEntity.builder()
                .pacienteId(req.getPacienteId())
                .medicoId(req.getMedicoId())
                .dataHora(req.getDataHora())
                .observacoes(req.getObservacoes())
                .status(StatusAgendamento.AGENDADO)
                .build();
        AgendamentoEntity saved = repository.save(entity);
        log.info("Agendamento {} criado (paciente={}, médico={})",
                saved.getId(), saved.getPacienteId(), saved.getMedicoId());
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<AgendamentoResponse> findAll() {
        return repository.findAll().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public AgendamentoResponse findById(Long id) {
        return toResponse(findEntity(id));
    }

    @Transactional(readOnly = true)
    public List<AgendamentoResponse> findByMedico(Long medicoId) {
        return repository.findByMedicoId(medicoId).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<AgendamentoResponse> findByPaciente(Long pacienteId) {
        return repository.findByPacienteId(pacienteId).stream().map(this::toResponse).toList();
    }

    public AgendamentoResponse atualizar(Long id, AgendamentoUpdateRequest req) {
        AgendamentoEntity entity = findEntity(id);
        if (entity.getStatus() == StatusAgendamento.REALIZADO
                || entity.getStatus() == StatusAgendamento.CANCELADO) {
            log.warn("Tentativa de atualizar agendamento {} com status terminal {}", id, entity.getStatus());
            throw new BusinessException("Agendamento " + entity.getStatus() + " não pode ser alterado");
        }
        if (req.getDataHora() != null) {
            validarHorarioLivre(entity.getMedicoId(), req.getDataHora());
            entity.setDataHora(req.getDataHora());
        }
        if (req.getStatus() != null) entity.setStatus(req.getStatus());
        if (req.getObservacoes() != null) entity.setObservacoes(req.getObservacoes());
        log.info("Agendamento {} atualizado", id);
        return toResponse(repository.save(entity));
    }

    public void cancelar(Long id) {
        AgendamentoEntity entity = findEntity(id);
        if (entity.getStatus() == StatusAgendamento.REALIZADO) {
            log.warn("Tentativa de cancelar agendamento {} já REALIZADO", id);
            throw new BusinessException("Agendamento já realizado não pode ser cancelado");
        }
        entity.setStatus(StatusAgendamento.CANCELADO);
        repository.save(entity);
        log.info("Agendamento {} cancelado", id);
    }

    private void validarPacienteExiste(Long id) {
        if (!lookupService.pacienteExiste(id)) {
            log.warn("Validação Feign: paciente {} não existe no administrativo", id);
            throw new EntityNotFoundException("Paciente com id " + id + " não encontrado");
        }
    }

    private void validarMedicoExiste(Long id) {
        if (!lookupService.medicoExiste(id)) {
            log.warn("Validação Feign: médico {} não existe no administrativo", id);
            throw new EntityNotFoundException("Médico com id " + id + " não encontrado");
        }
    }

    private void validarHorarioLivre(Long medicoId, LocalDateTime dataHora) {
        if (repository.existsByMedicoIdAndDataHoraAndStatusIn(medicoId, dataHora, ATIVOS)) {
            log.warn("Conflito de horário: médico {} já tem agendamento em {}", medicoId, dataHora);
            throw new BusinessException("Médico já tem agendamento ativo nesse horário");
        }
    }

    private AgendamentoEntity findEntity(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Agendamento com id " + id + " não encontrado"));
    }

    private AgendamentoResponse toResponse(AgendamentoEntity e) {
        return AgendamentoResponse.builder()
                .id(e.getId())
                .pacienteId(e.getPacienteId())
                .medicoId(e.getMedicoId())
                .dataHora(e.getDataHora())
                .status(e.getStatus())
                .observacoes(e.getObservacoes())
                .createdAt(e.getCreatedAt())
                .updatedAt(e.getUpdatedAt())
                .build();
    }
}
