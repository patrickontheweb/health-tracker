package com.example.habits;
import java.util.Map;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class EntriesControllerTest {
    private org.springframework.security.oauth2.jwt.Jwt jwt(){return org.springframework.security.oauth2.jwt.Jwt.withTokenValue("test").header("alg","test").subject("test-user").build();}
    @Test void settingsAreScopedToAuthenticatedUserAndRejectInvalidGoals(){
        var repo=mock(EntryRepository.class);var controller=new EntriesController(repo,new LogOwner("test-user"));
        var goals=new Goals(8,3,200);when(repo.saveGoals("test-user",goals)).thenReturn(goals);
        assertEquals(goals,controller.saveSettings(Map.of("produce",8,"lifting",3,"cardio",200),jwt()).getBody());
        verify(repo).saveGoals("test-user",goals);clearInvocations(repo);
        for(var bad:java.util.List.of(Map.<String,Object>of("produce",0,"lifting",3,"cardio",200),Map.<String,Object>of("produce",8,"lifting",1.5,"cardio",200),Map.<String,Object>of("produce",8,"lifting",3,"cardio",200,"user","other")))assertThrows(IllegalArgumentException.class,()->controller.saveSettings(bad,jwt()));
        verifyNoInteractions(repo);
    }
    @Test void mondayToSundayAcrossYears() {
        EntryRepository repo = mock(EntryRepository.class);when(repo.weekForUser(eq("test-user"),anyString(), anyString())).thenReturn(Map.of());
        assertEquals(200, new EntriesController(repo,new LogOwner("test-user")).week("2025-12-29",jwt()).getStatusCode().value());
        verify(repo).weekForUser("test-user","2025-12-29", "2026-01-04");
        assertThrows(IllegalArgumentException.class, () -> new EntriesController(repo,new LogOwner("test-user")).week("2026-01-01",jwt()));
    }
    @Test void invalidTotalsDoNotReachStorage() {
        EntryRepository repo = mock(EntryRepository.class);EntriesController controller = new EntriesController(repo,new LogOwner("test-user"));
        for(Object value : new Object[]{-1, 1.5, true, "5"}) assertThrows(IllegalArgumentException.class, () -> controller.saveFor("test-user","2026-01-01", Map.of("cardio", value, "lifting", 0, "produce", 5, "expectedRevision", 0)));
        verifyNoInteractions(repo);
    }
    @Test void savedEntriesKeepVersion() {
        EntryRepository repo=mock(EntryRepository.class);when(repo.weekForUser(anyString(),anyString(),anyString())).thenReturn(Map.of());when(repo.saveForUser("test-user","2026-01-01",30,1,5,2,null)).thenReturn(new Entry(30,1,5,3));
        var response = new EntriesController(repo,new LogOwner("test-user")).saveFor("test-user","2026-01-01", Map.of("cardio",30,"lifting",1,"produce",5,"expectedRevision",2));
        assertEquals(200,response.getStatusCode().value());verify(repo).saveForUser("test-user","2026-01-01",30,1,5,2,null);
    }
    @Test void publicUrlsResolveNamesOnTheServer(){
        var repo=mock(EntryRepository.class);when(repo.publicUser("alice")).thenReturn("alice-sub");when(repo.weekForUser("alice-sub","2026-01-05","2026-01-11")).thenReturn(Map.of());
        assertEquals(200,new EntriesController(repo,new LogOwner("test-user")).publicWeek("alice","2026-01-05").getStatusCode().value());
        verify(repo).weekForUser("alice-sub","2026-01-05","2026-01-11");
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->new EntriesController(repo,new LogOwner("test-user")).publicWeek("missing","2026-01-05"));
    }
    @Test void userCannotChooseAnotherPartitionInSaveBody(){
        var repo=mock(EntryRepository.class);var controller=new EntriesController(repo,new LogOwner("test-user"));
        assertThrows(IllegalArgumentException.class,()->controller.saveFor("alice-sub","2026-01-05",Map.of("cardio",0,"lifting",0,"produce",0,"expectedRevision",0,"user","bob-sub")));
        verifyNoInteractions(repo);
    }
    @Test void invalidMeasurementsAreRejectedBeforeStorage(){
        var repo=mock(EntryRepository.class);var controller=new EntriesController(repo,new LogOwner("test-user"));
        for(var sample:Map.of("systolic",0,"heartRate",1000,"sleepHours",24.1,"sugarGrams",-1,"sodiumMg",1.5).entrySet()){
            var body=new java.util.HashMap<String,Object>(Map.of("cardio",0,"lifting",0,"produce",0,"expectedRevision",0));body.put(sample.getKey(),sample.getValue());
            assertThrows(IllegalArgumentException.class,()->controller.saveFor("test-user","2026-01-01",body));
        }
        verifyNoInteractions(repo);
    }
}
