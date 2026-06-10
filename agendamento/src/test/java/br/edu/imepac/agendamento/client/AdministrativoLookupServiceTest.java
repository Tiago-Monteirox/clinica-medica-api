package br.edu.imepac.agendamento.client;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdministrativoLookupServiceTest {

    @Mock
    private AdministrativoClient administrativoClient;

    @InjectMocks
    private AdministrativoLookupService lookupService;

    @Test
    void pacienteExiste_delegaParaFeign() {
        when(administrativoClient.pacienteExiste(10L)).thenReturn(new ExistsResponse(true));

        boolean resultado = lookupService.pacienteExiste(10L);

        assertThat(resultado).isTrue();
        verify(administrativoClient, times(1)).pacienteExiste(10L);
    }

    @Test
    void pacienteNaoExiste_retornaFalse() {
        when(administrativoClient.pacienteExiste(99L)).thenReturn(new ExistsResponse(false));

        boolean resultado = lookupService.pacienteExiste(99L);

        assertThat(resultado).isFalse();
    }

    @Test
    void medicoExiste_delegaParaFeign() {
        when(administrativoClient.medicoExiste(5L)).thenReturn(new ExistsResponse(true));

        boolean resultado = lookupService.medicoExiste(5L);

        assertThat(resultado).isTrue();
        verify(administrativoClient, times(1)).medicoExiste(5L);
    }

    @Test
    void medicoNaoExiste_retornaFalse() {
        when(administrativoClient.medicoExiste(99L)).thenReturn(new ExistsResponse(false));

        boolean resultado = lookupService.medicoExiste(99L);

        assertThat(resultado).isFalse();
    }
}
