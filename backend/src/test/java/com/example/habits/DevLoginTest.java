package com.example.habits;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import tools.jackson.databind.ObjectMapper;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("local")
class DevLoginTest {
    @Value("${local.server.port}") int port;
    @MockitoBean EntryRepository repository;
    HttpClient browser=HttpClient.newHttpClient();
    @Test void localLoginAuthorizesAConditionalWrite() throws Exception {
        when(repository.weekForUser(anyString(),anyString(),anyString())).thenReturn(java.util.Map.of());when(repository.saveForUser("local-developer","2026-01-01",0,1,5,2,null)).thenReturn(new Entry(0,1,5,3));
        var login=browser.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/dev/login"))
            .header("Origin","http://127.0.0.1:4200").POST(HttpRequest.BodyPublishers.noBody()).build(),HttpResponse.BodyHandlers.ofString());
        assertEquals(200,login.statusCode());
        assertEquals("http://127.0.0.1:4200",login.headers().firstValue("Access-Control-Allow-Origin").orElse(""));
        String token=new ObjectMapper().readTree(login.body()).required("AuthenticationResult").required("AccessToken").asText();
        var save=browser.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/entries/2026-01-01"))
            .header("Content-Type","application/json").header("Authorization","Bearer "+token)
            .PUT(HttpRequest.BodyPublishers.ofString("{\"cardio\":0,\"lifting\":1,\"produce\":5,\"expectedRevision\":2}")).build(),HttpResponse.BodyHandlers.ofString());
        assertEquals(200,save.statusCode());verify(repository).saveForUser("local-developer","2026-01-01",0,1,5,2,null);
    }
    @Test void inventedDevTokensAreRejected() throws Exception {
        var response=browser.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/entries/2026-01-01"))
            .header("Authorization","Bearer dev-not-issued").PUT(HttpRequest.BodyPublishers.ofString("{}")).build(),HttpResponse.BodyHandlers.ofString());
        assertEquals(401,response.statusCode());
    }
    @Test void secondLoginUsesItsOwnSubjectForReadsAndWrites() throws Exception {
        when(repository.weekForUser(anyString(),anyString(),anyString())).thenReturn(java.util.Map.of());
        when(repository.saveForUser("local-alice","2026-01-01",0,0,1,0,null)).thenReturn(new Entry(0,0,1,1));
        var login=browser.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/dev/login")).header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofString("{\"user\":\"local-alice\"}")).build(),HttpResponse.BodyHandlers.ofString());
        String token=new ObjectMapper().readTree(login.body()).required("AuthenticationResult").required("AccessToken").asText();
        var read=browser.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/entries?week=2025-12-29")).header("Authorization","Bearer "+token).GET().build(),HttpResponse.BodyHandlers.ofString());
        assertEquals(200,read.statusCode());verify(repository).weekForUser("local-alice","2025-12-29","2026-01-04");
        var save=browser.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/entries/2026-01-01")).header("Content-Type","application/json").header("Authorization","Bearer "+token).PUT(HttpRequest.BodyPublishers.ofString("{\"cardio\":0,\"lifting\":0,\"produce\":1,\"expectedRevision\":0,\"weight\":null}")).build(),HttpResponse.BodyHandlers.ofString());
        assertEquals(200,save.statusCode());verify(repository).saveForUser("local-alice","2026-01-01",0,0,1,0,null);
    }
}
