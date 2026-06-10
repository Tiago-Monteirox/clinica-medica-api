package br.edu.imepac.atendimento.atendimento;

import br.edu.imepac.atendimento.atendimento.dto.AtendimentoRequest;
import br.edu.imepac.atendimento.atendimento.dto.AtendimentoResponse;
import br.edu.imepac.commons.exceptions.BusinessException;
import br.edu.imepac.commons.exceptions.EntityNotFoundException;
import br.edu.imepac.commons.exceptions.handler.GlobalExceptionHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.amqp.RabbitAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(
        controllers = AtendimentoController.class,
        excludeAutoConfiguration = {RabbitAutoConfiguration.class}
)
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
class AtendimentoControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean AtendimentoService service;

    private final ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());

    private AtendimentoResponse exemplo;

    @BeforeEach
    void setUp() {
        exemplo = AtendimentoResponse.builder()
                .id(7L)
                .agendamentoId(1L)
                .pacienteId(10L)
                .medicoId(20L)
                .dataAtendimento(LocalDateTime.of(2026, 6, 1, 14, 30))
                .diagnostico("H50.0 — Estrabismo convergente")
                .prescricao("Colírio X 2x ao dia")
                .observacoes("Retorno em 30 dias")
                .build();
    }

    @Test
    void findAll_retorna200ComLista() throws Exception {
        when(service.findAll()).thenReturn(List.of(exemplo));

        mockMvc.perform(get("/v1/atendimentos"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].id").value(7));
    }

    @Test
    void findById_retorna200() throws Exception {
        when(service.findById(7L)).thenReturn(exemplo);

        mockMvc.perform(get("/v1/atendimentos/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.diagnostico").value("H50.0 — Estrabismo convergente"));
    }

    @Test
    void findById_quandoNaoEncontra_retorna404() throws Exception {
        when(service.findById(eq(999L)))
                .thenThrow(new EntityNotFoundException("Atendimento com id 999 não encontrado"));

        mockMvc.perform(get("/v1/atendimentos/999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Atendimento com id 999 não encontrado"));
    }

    @Test
    void registrar_payloadValido_retorna201() throws Exception {
        var req = new AtendimentoRequest(1L, "Diagnóstico", "Prescrição", null);
        when(service.registrar(any(AtendimentoRequest.class))).thenReturn(exemplo);

        mockMvc.perform(post("/v1/atendimentos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").value(7));
    }

    @Test
    void registrar_payloadInvalido_retorna400() throws Exception {
        // diagnostico em branco viola @NotBlank
        String payload = """
            {"agendamentoId": 1, "diagnostico": "", "prescricao": "x"}
            """;

        mockMvc.perform(post("/v1/atendimentos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Erro de validação"));
    }

    @Test
    void registrar_atendimentoDuplicado_retorna422() throws Exception {
        var req = new AtendimentoRequest(1L, "Diag", "Presc", null);
        when(service.registrar(any())).thenThrow(new BusinessException("Já existe atendimento para este agendamento"));

        mockMvc.perform(post("/v1/atendimentos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(req)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.message").value("Já existe atendimento para este agendamento"));
    }

    @Test
    void findByPaciente_retorna200() throws Exception {
        when(service.findByPaciente(10L)).thenReturn(List.of(exemplo));

        mockMvc.perform(get("/v1/atendimentos/paciente/10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].pacienteId").value(10));
    }

    @Test
    void findByMedico_retorna200() throws Exception {
        when(service.findByMedico(20L)).thenReturn(List.of(exemplo));

        mockMvc.perform(get("/v1/atendimentos/medico/20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].medicoId").value(20));
    }

    @Test
    void atualizar_retorna200() throws Exception {
        when(service.atualizar(eq(7L), any())).thenReturn(exemplo);

        String body = """
            {"diagnostico":"Novo diagnóstico","prescricao":"Nova prescrição"}
            """;

        mockMvc.perform(put("/v1/atendimentos/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(7));
    }

    @Test
    void delete_retorna204() throws Exception {
        mockMvc.perform(delete("/v1/atendimentos/7"))
                .andExpect(status().isNoContent());
    }

    @Test
    void delete_quandoNaoEncontra_retorna404() throws Exception {
        doThrow(new EntityNotFoundException("Atendimento com id 999 não encontrado"))
                .when(service).delete(999L);

        mockMvc.perform(delete("/v1/atendimentos/999"))
                .andExpect(status().isNotFound());
    }
}
