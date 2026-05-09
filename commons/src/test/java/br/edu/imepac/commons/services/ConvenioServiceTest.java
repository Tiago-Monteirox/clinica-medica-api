package br.edu.imepac.commons.services;

import br.edu.imepac.commons.entities.ConvenioEntity;
import br.edu.imepac.commons.repositories.ConvenioRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ConvenioServiceTest {

    @Mock
    private ConvenioRepository convenioRepository;

    @InjectMocks
    private ConvenioService convenioService;

    @Test
    void findAllDeveRetornarListaDeConvenios() {
        List<ConvenioEntity> convenios = List.of(
                new ConvenioEntity(1L, "Unimed", "Plano regional"),
                new ConvenioEntity(2L, "Amil", "Plano nacional")
        );
        when(convenioRepository.findAll()).thenReturn(convenios);

        List<ConvenioEntity> resultado = convenioService.findAll();

        assertEquals(2, resultado.size());
        assertEquals("Unimed", resultado.get(0).getNome());
        verify(convenioRepository).findAll();
    }

    @Test
    void findByIdDeveRetornarConvenioQuandoExistir() {
        ConvenioEntity convenio = new ConvenioEntity(1L, "Unimed", "Plano regional");
        when(convenioRepository.findById(1L)).thenReturn(Optional.of(convenio));

        Optional<ConvenioEntity> resultado = convenioService.findById(1L);

        assertTrue(resultado.isPresent());
        assertEquals("Unimed", resultado.get().getNome());
        verify(convenioRepository).findById(1L);
    }

    @Test
    void saveDevePersistirConvenio() {
        ConvenioEntity novo = new ConvenioEntity(null, "Unimed", "Plano regional");
        ConvenioEntity salvo = new ConvenioEntity(1L, "Unimed", "Plano regional");
        when(convenioRepository.save(any(ConvenioEntity.class))).thenReturn(salvo);

        ConvenioEntity resultado = convenioService.save(novo);

        assertNotNull(resultado);
        assertNotNull(resultado.getId());
        assertEquals(1L, resultado.getId());

        verify(convenioRepository).save(novo);
        assertEquals("Unimed", resultado.getNome());
        assertEquals("Plano regional", resultado.getDescricao());
    }

    @Test
    void updateDeveAtualizarConvenioQuandoExistir() {
        ConvenioEntity existente = new ConvenioEntity(1L, "Unimed", "Antigo");
        ConvenioEntity dadosAtualizados = new ConvenioEntity(null, "Unimed Atualizado", "Novo");

        when(convenioRepository.findById(1L)).thenReturn(Optional.of(existente));
        when(convenioRepository.save(any(ConvenioEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Optional<ConvenioEntity> resultado = convenioService.update(1L, dadosAtualizados);

        assertTrue(resultado.isPresent());
        assertEquals("Unimed Atualizado", resultado.get().getNome());
        assertEquals("Novo", resultado.get().getDescricao());
        verify(convenioRepository).findById(1L);
        verify(convenioRepository).save(existente);
    }

    @Test
    void updateDeveRetornarVazioQuandoNaoExistir() {
        ConvenioEntity dadosAtualizados = new ConvenioEntity(null, "Unimed Atualizado", "Novo");
        when(convenioRepository.findById(99L)).thenReturn(Optional.empty());

        Optional<ConvenioEntity> resultado = convenioService.update(99L, dadosAtualizados);

        assertTrue(resultado.isEmpty());
        verify(convenioRepository).findById(99L);
        verify(convenioRepository, never()).save(any(ConvenioEntity.class));
    }

    @Test
    void deleteByIdDeveExcluirQuandoExistir() {
        when(convenioRepository.existsById(1L)).thenReturn(true);

        boolean removido = convenioService.deleteById(1L);

        assertTrue(removido);
        verify(convenioRepository).existsById(1L);
        verify(convenioRepository).deleteById(1L);
    }

    @Test
    void deleteByIdNaoDeveExcluirQuandoNaoExistir() {
        when(convenioRepository.existsById(99L)).thenReturn(false);

        boolean removido = convenioService.deleteById(99L);

        assertFalse(removido);
        verify(convenioRepository).existsById(99L);
        verify(convenioRepository, never()).deleteById(anyLong());
    }
}

