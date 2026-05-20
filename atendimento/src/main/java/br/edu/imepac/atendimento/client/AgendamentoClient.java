package br.edu.imepac.atendimento.client;

import br.edu.imepac.commons.dto.ApiResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.time.LocalDateTime;

@FeignClient(name = "agendamento",
        url = "${agendamento.url}",
        configuration = FeignConfig.class)
public interface AgendamentoClient {

    @GetMapping("/v1/agendamentos/{id}")
    ApiResponse<AgendamentoSnapshot> buscar(@PathVariable("id") Long id);

    record AgendamentoSnapshot(
            Long id,
            Long pacienteId,
            Long medicoId,
            LocalDateTime dataHora,
            String status,
            String observacoes
    ) {}
}
