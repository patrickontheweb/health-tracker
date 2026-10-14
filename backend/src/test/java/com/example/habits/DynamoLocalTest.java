package com.example.habits;

import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import static org.junit.jupiter.api.Assertions.*;

class DynamoLocalTest {
    @Test void localEndpointsCannotPointAtProduction() {
        for(String endpoint:new String[]{"https://dynamodb.us-east-1.amazonaws.com","http://example.com:8000","http://localhost@evil.example:8000","http://127.0.0.1:8000/path",""})
            assertThrows(IllegalArgumentException.class,()->DynamoClients.localEndpoint(endpoint));
        assertEquals("127.0.0.1",DynamoClients.localEndpoint("http://127.0.0.1:8000").getHost());
    }
    @Test
    @EnabledIfEnvironmentVariable(named="DYNAMODB_TEST_ENDPOINT",matches=".+")
    void persistsRecordsAndRejectsStaleWritesAcrossRestarts() {
        String endpoint=System.getenv("DYNAMODB_TEST_ENDPOINT"),table="habits-test-"+UUID.randomUUID();
        var client=DynamoClients.create(true,endpoint);
        try {
            var repo=new DynamoEntryRepository(client,table,true);
            assertEquals(Map.of(),repo.week("2025-12-29","2026-01-04"));
            assertEquals(new Entry(150,2,5,1),repo.save("2025-12-29",150,2,5,0));
            assertEquals(new Entry(0,0,2,1),repo.save("2026-01-04",0,0,2,0));
            assertThrows(StaleEntryException.class,()->repo.save("2025-12-29",0,0,0,0));
            assertEquals(new Entry(30,1,3,2),repo.save("2025-12-29",30,1,3,1));
            assertThrows(StaleEntryException.class,()->repo.save("2025-12-29",0,0,0,1));
            assertThrows(StaleEntryException.class,()->repo.save("2026-01-05",0,0,0,2));
            try(var secondClient=DynamoClients.create(true,endpoint)) {
                var restarted=new DynamoEntryRepository(secondClient,table,true);
                assertEquals(Map.of("2025-12-29",new Entry(30,1,3,2),"2026-01-04",new Entry(0,0,2,1)),restarted.week("2025-12-29","2026-01-04"));
                assertEquals(Map.of(),restarted.week("2026-01-05","2026-01-11"));
                assertEquals(185L,restarted.save("2025-12-29",30,1,3,2,185L).weight());
                assertEquals(185L,restarted.week("2025-12-29","2025-12-29").get("2025-12-29").weight());
                assertEquals(185L,restarted.save("2025-12-29",45,1,6,3).weight());
                assertNull(restarted.save("2025-12-29",45,1,6,4,null).weight());
                restarted.copyLegacyToUser("owner");
                assertEquals(6,restarted.weekForUser("owner","2025-12-29","2025-12-29").get("2025-12-29").produce());
                assertTrue(restarted.weekForUser("someone-else","2025-12-29","2026-01-04").isEmpty());
                restarted.saveForUser("someone-else","2025-12-29",1,0,1,0,200L);
                assertEquals(6,restarted.weekForUser("owner","2025-12-29","2025-12-29").get("2025-12-29").produce());
                restarted.saveForUser("owner","2025-12-29",50,1,7,5,180L);
                restarted.copyLegacyToUser("owner");
                assertEquals(7,restarted.weekForUser("owner","2025-12-29","2025-12-29").get("2025-12-29").produce());
                assertEquals(6,restarted.week("2025-12-29","2025-12-29").get("2025-12-29").produce());
                restarted.ensureProfile("owner","alice");assertEquals("owner",restarted.publicUser("ALICE"));
                assertNull(restarted.publicUser("missing"));
                assertThrows(StaleEntryException.class,()->restarted.ensureProfile("someone-else","alice"));
                Entry measurements=new Entry(50,1,7,0,180L,120L,80L,60L,7.5,2100L,25.5,12.3,1800L);
                Entry saved=restarted.saveMeasurements("owner","2025-12-29",measurements,6);
                assertEquals(saved,restarted.weekForUser("owner","2025-12-29","2025-12-29").get("2025-12-29"));
                Entry activity=restarted.saveForUser("owner","2025-12-29",60,1,8,7,180L);
                assertEquals(7.5,activity.sleepHours());assertEquals(25.5,activity.sugarGrams());assertEquals(120L,activity.systolic());assertEquals(1800L,activity.sodiumMg());
                assertNull(restarted.saveMeasurements("owner","2025-12-29",new Entry(60,1,8,0,180L),8).sleepHours());
            }
        } finally { client.deleteTable(r -> r.tableName(table));client.close(); }
    }
}
