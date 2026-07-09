package br.edu.imepac.administrativo.paciente;

import br.edu.imepac.administrativo.paciente.dto.PacienteRequest;
import br.edu.imepac.administrativo.paciente.dto.PacienteResponse;
import br.edu.imepac.commons.dto.ApiResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.modelmapper.ModelMapper;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PacienteControllerTest {

    @Mock
    private PacienteService pacienteService;

    private PacienteController controller;

    @BeforeEach
    void setUp() {
        controller = new PacienteController(pacienteService, new ModelMapper());
    }

    @Test
    void createNaoDeveMapearConvenioIdComoIdDoPaciente() {
        PacienteRequest request = new PacienteRequest(
                "Paciente Fluxo",
                "paciente.fluxo@example.com",
                "12345678901",
                "11999999999",
                LocalDate.of(1990, 1, 15),
                9L
        );

        when(pacienteService.save(any(PacienteEntity.class), eq(9L))).thenAnswer(invocation -> {
            PacienteEntity entity = invocation.getArgument(0);
            PacienteEntity saved = new PacienteEntity();
            saved.setId(42L);
            saved.setNome(entity.getNome());
            saved.setEmail(entity.getEmail());
            saved.setCpf(entity.getCpf());
            saved.setTelefone(entity.getTelefone());
            saved.setDataNascimento(entity.getDataNascimento());
            return saved;
        });

        ResponseEntity<ApiResponse<PacienteResponse>> response = controller.create(request);

        ArgumentCaptor<PacienteEntity> entityCaptor = ArgumentCaptor.forClass(PacienteEntity.class);
        verify(pacienteService).save(entityCaptor.capture(), eq(9L));

        PacienteEntity entity = entityCaptor.getValue();
        assertNull(entity.getId());
        assertNull(entity.getConvenio());
        assertEquals("Paciente Fluxo", entity.getNome());
        assertEquals("paciente.fluxo@example.com", entity.getEmail());
        assertEquals("12345678901", entity.getCpf());
        assertEquals(HttpStatus.CREATED, response.getStatusCode());
    }
}
