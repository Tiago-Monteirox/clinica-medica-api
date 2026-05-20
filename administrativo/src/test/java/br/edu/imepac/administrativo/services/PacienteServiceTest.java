package br.edu.imepac.administrativo.services;

import br.edu.imepac.administrativo.convenio.ConvenioEntity;
import br.edu.imepac.administrativo.convenio.ConvenioService;
import br.edu.imepac.administrativo.paciente.PacienteEntity;
import br.edu.imepac.administrativo.paciente.PacienteRepository;
import br.edu.imepac.administrativo.paciente.PacienteService;
import br.edu.imepac.commons.exceptions.BusinessException;
import br.edu.imepac.commons.exceptions.EntityNotFoundException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PacienteServiceTest {

    @Mock
    private PacienteRepository repository;

    @Mock
    private ConvenioService convenioService;

    @InjectMocks
    private PacienteService service;

    @Test
    void saveSemConvenioDevePersistir() {
        PacienteEntity novo = PacienteEntity.builder().nome("J").email("j@j.com").cpf("11111111111").build();
        when(repository.existsByEmail(anyString())).thenReturn(false);
        when(repository.existsByCpf(anyString())).thenReturn(false);
        when(repository.save(any(PacienteEntity.class))).thenAnswer(inv -> {
            PacienteEntity p = inv.getArgument(0);
            p.setId(1L);
            return p;
        });

        PacienteEntity saved = service.save(novo, null);

        assertEquals(1L, saved.getId());
        assertNull(saved.getConvenio());
        verifyNoInteractions(convenioService);
    }

    @Test
    void saveComConvenioInexistenteDevePropagar404() {
        PacienteEntity novo = PacienteEntity.builder().nome("J").email("j@j.com").cpf("11111111111").build();
        when(repository.existsByEmail(anyString())).thenReturn(false);
        when(repository.existsByCpf(anyString())).thenReturn(false);
        when(convenioService.findById(99L))
                .thenThrow(new EntityNotFoundException("Convênio não encontrado"));

        assertThrows(EntityNotFoundException.class, () -> service.save(novo, 99L));
        verify(repository, never()).save(any());
    }

    @Test
    void saveDeveLancarBusinessQuandoEmailDuplicado() {
        PacienteEntity novo = PacienteEntity.builder().nome("J").email("j@j.com").cpf("11111111111").build();
        when(repository.existsByEmail("j@j.com")).thenReturn(true);
        assertThrows(BusinessException.class, () -> service.save(novo, null));
    }

    @Test
    void saveDeveLancarBusinessQuandoCpfDuplicado() {
        PacienteEntity novo = PacienteEntity.builder().nome("J").email("j@j.com").cpf("11111111111").build();
        when(repository.existsByEmail(anyString())).thenReturn(false);
        when(repository.existsByCpf("11111111111")).thenReturn(true);
        assertThrows(BusinessException.class, () -> service.save(novo, null));
    }

    @Test
    void saveComConvenioValidoDeveResolverFK() {
        PacienteEntity novo = PacienteEntity.builder().nome("J").email("j@j.com").cpf("11111111111").build();
        ConvenioEntity conv = ConvenioEntity.builder().id(7L).nome("Unimed").build();
        when(repository.existsByEmail(anyString())).thenReturn(false);
        when(repository.existsByCpf(anyString())).thenReturn(false);
        when(convenioService.findById(7L)).thenReturn(conv);
        when(repository.save(any(PacienteEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        PacienteEntity saved = service.save(novo, 7L);

        assertEquals(7L, saved.getConvenio().getId());
    }
}
