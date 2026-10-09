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
            }
        } finally { client.deleteTable(r -> r.tableName(table));client.close(); }
    }
}
