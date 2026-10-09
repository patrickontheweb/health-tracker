package com.example.habits;
import java.util.Map;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class EntriesControllerTest {
    @Test void mondayToSundayAcrossYears() {
        EntryRepository repo = mock(EntryRepository.class);when(repo.week(anyString(), anyString())).thenReturn(Map.of());
        assertEquals(200, new EntriesController(repo).week("2025-12-29").getStatusCode().value());
        verify(repo).week("2025-12-29", "2026-01-04");
        assertThrows(IllegalArgumentException.class, () -> new EntriesController(repo).week("2026-01-01"));
    }
    @Test void invalidTotalsDoNotReachStorage() {
        EntryRepository repo = mock(EntryRepository.class);EntriesController controller = new EntriesController(repo);
        for(Object value : new Object[]{-1, 1.5, true, "5"}) assertThrows(IllegalArgumentException.class, () -> controller.save("2026-01-01", Map.of("cardio", value, "lifting", 0, "produce", 5, "expectedRevision", 0)));
        verifyNoInteractions(repo);
    }
    @Test void savedEntriesKeepVersion() {
        EntryRepository repo=mock(EntryRepository.class);when(repo.save("2026-01-01",30,1,5,2)).thenReturn(new Entry(30,1,5,3));
        var response = new EntriesController(repo).save("2026-01-01", Map.of("cardio",30,"lifting",1,"produce",5,"expectedRevision",2));
        assertEquals(200,response.getStatusCode().value());verify(repo).save("2026-01-01",30,1,5,2);
    }
}
