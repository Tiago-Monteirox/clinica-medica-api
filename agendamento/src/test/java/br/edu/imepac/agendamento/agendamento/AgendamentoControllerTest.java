package br.edu.imepac.agendamento.agendamento;

import br.edu.imepac.agendamento.agendamento.dto.AgendamentoRequest;
import br.edu.imepac.agendamento.agendamento.dto.AgendamentoResponse;
import br.edu.imepac.agendamento.agendamento.enums.StatusAgendamento;
import br.edu.imepac.commons.exceptions.EntityNotFoundException;
import br.edu.imepac.commons.exceptions.handler.GlobalExceptionHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.amqp.RabbitAutoConfiguration;
import org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration;
import org.springframework.boot.autoconfigure.data.redis.RedisRepositoriesAutoConfiguration;
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
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(
        controllers = AgendamentoController.class,
        excludeAutoConfiguration = {
            RedisAutoConfiguration.class,
            RedisRepositoriesAutoConfiguration.class,
            RabbitAutoConfiguration.class
        }
)
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
class AgendamentoControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean AgendamentoService service;

    private final ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());

    private AgendamentoResponse exemplo;

    @BeforeEach
    void setUp() {
        exemplo = AgendamentoResponse.builder()
                .id(1L)
                .pacienteId(10L)
                .medicoId(20L)
                .dataHora(LocalDateTime.of(2026, 6, 1, 14, 30))
                .status(StatusAgendamento.AGENDADO)
                .observacoes("primeira consulta")
                .build();
    }

    @Test
    void findAll_retorna200ComListaEnvelopadaEmApiResponse() throws Exception {
        when(service.findAll()).thenReturn(List.of(exemplo));

        mockMvc.perform(get("/v1/agendamentos"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].id").value(1))
                .andExpect(jsonPath("$.data[0].status").value("AGENDADO"));
    }

    @Test
    void findById_retorna200ComEnvelope() throws Exception {
        when(service.findById(1L)).thenReturn(exemplo);

        mockMvc.perform(get("/v1/agendamentos/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.pacienteId").value(10))
                .andExpect(jsonPath("$.data.medicoId").value(20));
    }

    @Test
    void findById_quandoServiceLancaNotFound_retorna404() throws Exception {
        when(service.findById(eq(999L)))
                .thenThrow(new EntityNotFoundException("Agendamento com id 999 não encontrado"));

        mockMvc.perform(get("/v1/agendamentos/999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Agendamento com id 999 não encontrado"));
    }

    @Test
    void criar_payloadValido_retorna201ComEnvelope() throws Exception {
        var req = new AgendamentoRequest(10L, 20L, LocalDateTime.now().plusDays(7), "obs");
        when(service.criar(any(AgendamentoRequest.class))).thenReturn(exemplo);

        mockMvc.perform(post("/v1/agendamentos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").value(1));
    }

    @Test
    void criar_payloadInvalido_retorna400DoGlobalExceptionHandler() throws Exception {
        // pacienteId e medicoId omitidos (são @NotNull); dataHora no passado (@Future)
        String payloadInvalido = """
            {"dataHora": "2020-01-01T10:00:00"}
            """;

        mockMvc.perform(post("/v1/agendamentos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payloadInvalido))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Erro de validação"));
    }

    @Test
    void findByMedico_retorna200ComListaFiltrada() throws Exception {
        when(service.findByMedico(20L)).thenReturn(List.of(exemplo));

        mockMvc.perform(get("/v1/agendamentos/medico/20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].medicoId").value(20));
    }

    @Test
    void findByPaciente_retorna200ComListaFiltrada() throws Exception {
        when(service.findByPaciente(10L)).thenReturn(List.of(exemplo));

        mockMvc.perform(get("/v1/agendamentos/paciente/10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].pacienteId").value(10));
    }

    @Test
    void atualizar_retorna200ComEnvelope() throws Exception {
        var atualizado = AgendamentoResponse.builder()
                .id(1L).pacienteId(10L).medicoId(20L)
                .dataHora(LocalDateTime.of(2026, 7, 1, 10, 0))
                .status(StatusAgendamento.CONFIRMADO).build();
        when(service.atualizar(eq(1L), any())).thenReturn(atualizado);

        String body = """
            {"dataHora":"2026-07-01T10:00:00","status":"CONFIRMADO"}
            """;

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .put("/v1/agendamentos/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CONFIRMADO"));
    }

    @Test
    void cancelar_retorna204SemBody() throws Exception {
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .delete("/v1/agendamentos/1"))
                .andExpect(status().isNoContent());
    }
}
