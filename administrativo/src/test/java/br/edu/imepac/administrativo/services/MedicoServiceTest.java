package br.edu.imepac.administrativo.services;

import br.edu.imepac.administrativo.medico.MedicoEntity;
import br.edu.imepac.administrativo.medico.MedicoRepository;
import br.edu.imepac.administrativo.medico.MedicoService;
import br.edu.imepac.commons.exceptions.BusinessException;
import br.edu.imepac.commons.exceptions.EntityNotFoundException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MedicoServiceTest {

    @Mock
    private MedicoRepository repository;

    @InjectMocks
    private MedicoService service;

    @Test
    void findByIdDeveLancar404QuandoNaoExistir() {
        when(repository.findById(99L)).thenReturn(Optional.empty());
        assertThrows(EntityNotFoundException.class, () -> service.findById(99L));
    }

    @Test
    void existsByIdDeveDelegarAoRepository() {
        when(repository.existsById(1L)).thenReturn(true);
        assertTrue(service.existsById(1L));
        verify(repository).existsById(1L);
    }

    @Test
    void saveDeveLancarBusinessQuandoEmailDuplicado() {
        MedicoEntity novo = MedicoEntity.builder().nome("X").email("x@x.com").crm("CRM 1").build();
        when(repository.existsByEmail("x@x.com")).thenReturn(true);
        assertThrows(BusinessException.class, () -> service.save(novo));
        verify(repository, never()).save(any());
    }

    @Test
    void saveDeveLancarBusinessQuandoCrmDuplicado() {
        MedicoEntity novo = MedicoEntity.builder().nome("X").email("x@x.com").crm("CRM 1").build();
        when(repository.existsByEmail(anyString())).thenReturn(false);
        when(repository.existsByCrm("CRM 1")).thenReturn(true);
        assertThrows(BusinessException.class, () -> service.save(novo));
    }

    @Test
    void deleteByIdDeveLancar404QuandoNaoExistir() {
        when(repository.existsById(99L)).thenReturn(false);
        assertThrows(EntityNotFoundException.class, () -> service.deleteById(99L));
        verify(repository, never()).deleteById(anyLong());
    }
}
