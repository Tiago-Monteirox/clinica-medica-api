package br.edu.imepac.atendimento.prontuario;

import br.edu.imepac.atendimento.prontuario.dto.HistoricoClinicoResponse;
import br.edu.imepac.atendimento.prontuario.dto.ProntuarioResponse;
import br.edu.imepac.commons.exceptions.BusinessException;
import br.edu.imepac.commons.exceptions.handler.GlobalExceptionHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.annotation.RabbitListenerAnnotationBeanPostProcessor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.amqp.autoconfigure.RabbitAutoConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(
        controllers = ProntuarioController.class,
        excludeAutoConfiguration = {RabbitAutoConfiguration.class}
)
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
class ProntuarioControllerTest {

    @Autowired MockMvc mockMvc;
    @MockitoBean ProntuarioService service;
    @MockitoBean RabbitListenerAnnotationBeanPostProcessor rabbitListenerAnnotationBeanPostProcessor;

    private final ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());

    @Test
    void salvarRascunhoRetorna200() throws Exception {
        when(service.salvarRascunho(eq(7L), any())).thenReturn(response());

        mockMvc.perform(put("/v1/prontuarios/atendimento/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"resumo":"Resumo clínico"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(9))
                .andExpect(jsonPath("$.data.status").value("RASCUNHO"));
    }

    @Test
    void finalizarQuandoResumoAusenteRetorna422() throws Exception {
        when(service.finalizar(eq(9L), any()))
                .thenThrow(new BusinessException("Resumo do prontuário é obrigatório para finalizar"));

        mockMvc.perform(post("/v1/prontuarios/9/finalizar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.message").value("Resumo do prontuário é obrigatório para finalizar"));
    }

    @Test
    void historicoRetorna200() throws Exception {
        when(service.historicoPorPaciente(10L, false))
                .thenReturn(HistoricoClinicoResponse.builder()
                        .pacienteId(10L)
                        .incluindoRascunhos(false)
                        .itens(List.of())
                        .build());

        mockMvc.perform(get("/v1/prontuarios/paciente/10/historico"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.pacienteId").value(10));
    }

    private ProntuarioResponse response() {
        return ProntuarioResponse.builder()
                .id(9L)
                .atendimentoId(7L)
                .agendamentoId(6L)
                .pacienteId(10L)
                .medicoId(20L)
                .dataAtendimento(LocalDateTime.of(2026, 7, 9, 14, 0))
                .resumo("Resumo clínico")
                .status(StatusProntuario.RASCUNHO)
                .build();
    }
}
