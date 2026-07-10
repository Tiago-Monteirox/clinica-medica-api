package br.edu.imepac.atendimento.prontuario;

import br.edu.imepac.atendimento.atendimento.AtendimentoEntity;
import br.edu.imepac.atendimento.atendimento.AtendimentoRepository;
import br.edu.imepac.atendimento.prontuario.dto.FinalizarProntuarioRequest;
import br.edu.imepac.atendimento.prontuario.dto.HistoricoClinicoItemResponse;
import br.edu.imepac.atendimento.prontuario.dto.HistoricoClinicoResponse;
import br.edu.imepac.atendimento.prontuario.dto.ProntuarioRequest;
import br.edu.imepac.atendimento.prontuario.dto.ProntuarioResponse;
import br.edu.imepac.commons.exceptions.BusinessException;
import br.edu.imepac.commons.exceptions.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@Transactional
public class ProntuarioService {

    private final ProntuarioRepository prontuarioRepository;
    private final AtendimentoRepository atendimentoRepository;

    public ProntuarioService(ProntuarioRepository prontuarioRepository,
                             AtendimentoRepository atendimentoRepository) {
        this.prontuarioRepository = prontuarioRepository;
        this.atendimentoRepository = atendimentoRepository;
    }

    @Transactional(readOnly = true)
    public ProntuarioResponse findByAtendimento(Long atendimentoId) {
        return prontuarioRepository.findByAtendimentoId(atendimentoId)
                .map(this::toResponse)
                .orElseThrow(() -> new EntityNotFoundException(
                        "Prontuário do atendimento " + atendimentoId + " não encontrado"));
    }

    public ProntuarioResponse salvarRascunho(Long atendimentoId, ProntuarioRequest request) {
        AtendimentoEntity atendimento = atendimentoRepository.findById(atendimentoId)
                .orElseThrow(() -> new EntityNotFoundException(
                        "Atendimento com id " + atendimentoId + " não encontrado"));

        ProntuarioEntity prontuario = prontuarioRepository.findByAtendimentoId(atendimentoId)
                .orElseGet(() -> novoProntuario(atendimento));

        if (prontuario.getStatus() == StatusProntuario.FINALIZADO) {
            throw new BusinessException("Prontuário finalizado não pode ser alterado");
        }

        aplicarRequest(prontuario, request);
        return toResponse(prontuarioRepository.save(prontuario));
    }

    public ProntuarioResponse finalizar(Long id, FinalizarProntuarioRequest request) {
        ProntuarioEntity prontuario = findEntity(id);

        if (prontuario.getStatus() == StatusProntuario.FINALIZADO) {
            throw new BusinessException("Prontuário já está finalizado");
        }

        if (request != null && !isBlank(request.getResumo())) {
            prontuario.setResumo(request.getResumo());
        }

        if (isBlank(prontuario.getResumo())) {
            throw new BusinessException("Resumo do prontuário é obrigatório para finalizar");
        }

        prontuario.setStatus(StatusProntuario.FINALIZADO);
        prontuario.setFinalizadoEm(LocalDateTime.now());

        return toResponse(prontuarioRepository.save(prontuario));
    }

    @Transactional(readOnly = true)
    public HistoricoClinicoResponse historicoPorPaciente(Long pacienteId, boolean incluirRascunhos) {
        List<ProntuarioEntity> prontuarios = incluirRascunhos
                ? prontuarioRepository.findByPacienteIdOrderByDataAtendimentoDesc(pacienteId)
                : prontuarioRepository.findByPacienteIdAndStatusOrderByDataAtendimentoDesc(
                        pacienteId, StatusProntuario.FINALIZADO);

        return HistoricoClinicoResponse.builder()
                .pacienteId(pacienteId)
                .incluindoRascunhos(incluirRascunhos)
                .itens(prontuarios.stream().map(this::toHistoricoItem).toList())
                .build();
    }

    private ProntuarioEntity novoProntuario(AtendimentoEntity atendimento) {
        return ProntuarioEntity.builder()
                .atendimentoId(atendimento.getId())
                .agendamentoId(atendimento.getAgendamentoId())
                .pacienteId(atendimento.getPacienteId())
                .medicoId(atendimento.getMedicoId())
                .dataAtendimento(atendimento.getDataAtendimento())
                .diagnostico(atendimento.getDiagnostico())
                .prescricao(atendimento.getPrescricao())
                .observacoes(atendimento.getObservacoes())
                .status(StatusProntuario.RASCUNHO)
                .build();
    }

    private void aplicarRequest(ProntuarioEntity prontuario, ProntuarioRequest request) {
        if (request == null) return;
        if (request.getQueixaPrincipal() != null) prontuario.setQueixaPrincipal(request.getQueixaPrincipal());
        if (request.getHistoriaDoencaAtual() != null) prontuario.setHistoriaDoencaAtual(request.getHistoriaDoencaAtual());
        if (request.getResumo() != null) prontuario.setResumo(request.getResumo());
        if (request.getDiagnostico() != null) prontuario.setDiagnostico(request.getDiagnostico());
        if (request.getConduta() != null) prontuario.setConduta(request.getConduta());
        if (request.getPrescricao() != null) prontuario.setPrescricao(request.getPrescricao());
        if (request.getObservacoes() != null) prontuario.setObservacoes(request.getObservacoes());
    }

    private ProntuarioEntity findEntity(Long id) {
        return prontuarioRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Prontuário com id " + id + " não encontrado"));
    }

    private ProntuarioResponse toResponse(ProntuarioEntity prontuario) {
        return ProntuarioResponse.builder()
                .id(prontuario.getId())
                .atendimentoId(prontuario.getAtendimentoId())
                .agendamentoId(prontuario.getAgendamentoId())
                .pacienteId(prontuario.getPacienteId())
                .medicoId(prontuario.getMedicoId())
                .dataAtendimento(prontuario.getDataAtendimento())
                .queixaPrincipal(prontuario.getQueixaPrincipal())
                .historiaDoencaAtual(prontuario.getHistoriaDoencaAtual())
                .resumo(prontuario.getResumo())
                .diagnostico(prontuario.getDiagnostico())
                .conduta(prontuario.getConduta())
                .prescricao(prontuario.getPrescricao())
                .observacoes(prontuario.getObservacoes())
                .status(prontuario.getStatus())
                .finalizadoEm(prontuario.getFinalizadoEm())
                .createdAt(prontuario.getCreatedAt())
                .updatedAt(prontuario.getUpdatedAt())
                .build();
    }

    private HistoricoClinicoItemResponse toHistoricoItem(ProntuarioEntity prontuario) {
        return HistoricoClinicoItemResponse.builder()
                .prontuarioId(prontuario.getId())
                .atendimentoId(prontuario.getAtendimentoId())
                .agendamentoId(prontuario.getAgendamentoId())
                .pacienteId(prontuario.getPacienteId())
                .medicoId(prontuario.getMedicoId())
                .dataAtendimento(prontuario.getDataAtendimento())
                .status(prontuario.getStatus())
                .resumo(prontuario.getResumo())
                .diagnostico(prontuario.getDiagnostico())
                .conduta(prontuario.getConduta())
                .prescricao(prontuario.getPrescricao())
                .build();
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
