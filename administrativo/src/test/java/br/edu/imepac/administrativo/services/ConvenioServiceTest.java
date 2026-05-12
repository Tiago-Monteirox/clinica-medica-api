package br.edu.imepac.administrativo.services;

import br.edu.imepac.administrativo.entities.ConvenioEntity;
import br.edu.imepac.administrativo.repositories.ConvenioRepository;
import br.edu.imepac.commons.exceptions.EntityNotFoundException;
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

        ConvenioEntity resultado = convenioService.findById(1L);

        assertEquals("Unimed", resultado.getNome());
        verify(convenioRepository).findById(1L);
    }

    @Test
    void findByIdDeveLancarExcecaoQuandoNaoExistir() {
        when(convenioRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class, () -> convenioService.findById(99L));
        verify(convenioRepository).findById(99L);
    }

    @Test
    void saveDevePersistirConvenio() {
        ConvenioEntity novo = new ConvenioEntity(null, "Unimed", "Plano regional");
        ConvenioEntity salvo = new ConvenioEntity(1L, "Unimed", "Plano regional");
        when(convenioRepository.save(any(ConvenioEntity.class))).thenReturn(salvo);

        ConvenioEntity resultado = convenioService.save(novo);

        assertNotNull(resultado.getId());
        assertEquals(1L, resultado.getId());
        assertEquals("Unimed", resultado.getNome());
        verify(convenioRepository).save(novo);
    }

    @Test
    void updateDeveAtualizarConvenioQuandoExistir() {
        ConvenioEntity existente = new ConvenioEntity(1L, "Unimed", "Antigo");
        ConvenioEntity dadosAtualizados = new ConvenioEntity(null, "Unimed Atualizado", "Novo");

        when(convenioRepository.findById(1L)).thenReturn(Optional.of(existente));
        when(convenioRepository.save(any(ConvenioEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ConvenioEntity resultado = convenioService.update(1L, dadosAtualizados);

        assertEquals("Unimed Atualizado", resultado.getNome());
        assertEquals("Novo", resultado.getDescricao());
        verify(convenioRepository).findById(1L);
        verify(convenioRepository).save(existente);
    }

    @Test
    void updateDeveLancarExcecaoQuandoNaoExistir() {
        ConvenioEntity dadosAtualizados = new ConvenioEntity(null, "Unimed Atualizado", "Novo");
        when(convenioRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class, () -> convenioService.update(99L, dadosAtualizados));
        verify(convenioRepository, never()).save(any());
    }

    @Test
    void deleteByIdDeveExcluirQuandoExistir() {
        when(convenioRepository.existsById(1L)).thenReturn(true);

        assertDoesNotThrow(() -> convenioService.deleteById(1L));
        verify(convenioRepository).deleteById(1L);
    }

    @Test
    void deleteByIdDeveLancarExcecaoQuandoNaoExistir() {
        when(convenioRepository.existsById(99L)).thenReturn(false);

        assertThrows(EntityNotFoundException.class, () -> convenioService.deleteById(99L));
        verify(convenioRepository, never()).deleteById(anyLong());
    }
}
