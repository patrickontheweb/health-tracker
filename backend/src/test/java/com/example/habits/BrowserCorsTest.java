package com.example.habits;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={
    "habits.issuer=https://example.com/pool","habits.client-id=test-client",
    "habits.origin=http://127.0.0.1:4200","habits.local=false"})
class BrowserCorsTest {
    @Value("${local.server.port}") int port;
    @MockitoBean EntryRepository repository;
    final HttpClient browser=HttpClient.newHttpClient();
    @BeforeEach void prepare() { when(repository.week(anyString(),anyString())).thenReturn(Map.of()); }
    @Test void localBrowserCanLoadHistory() throws Exception {
        var response=browser.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/entries?week=2026-10-12"))
            .header("Origin","http://127.0.0.1:4200").GET().build(),HttpResponse.BodyHandlers.ofString());
        assertEquals(200,response.statusCode());
        assertEquals("http://127.0.0.1:4200",response.headers().firstValue("Access-Control-Allow-Origin").orElse(""));
        assertTrue(response.body().contains("entries"));
    }
    @Test void savePreflightAllowsAuthorizationHeader() throws Exception {
        var response=browser.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/entries/2026-10-13"))
            .header("Origin","http://127.0.0.1:4200").header("Access-Control-Request-Method","PUT")
            .header("Access-Control-Request-Headers","authorization,content-type")
            .method("OPTIONS",HttpRequest.BodyPublishers.noBody()).build(),HttpResponse.BodyHandlers.ofString());
        assertEquals(200,response.statusCode());
        assertEquals("http://127.0.0.1:4200",response.headers().firstValue("Access-Control-Allow-Origin").orElse(""));
        assertTrue(response.headers().firstValue("Access-Control-Allow-Headers").orElse("").toLowerCase().contains("authorization"));
    }
    @Test void unrelatedBrowserOriginsAreRejected() throws Exception {
        var response=browser.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/entries?week=2026-10-12"))
            .header("Origin","https://example.org").GET().build(),HttpResponse.BodyHandlers.ofString());
        assertEquals(403,response.statusCode());
        assertTrue(response.headers().firstValue("Access-Control-Allow-Origin").isEmpty());
    }
    @Test void productionHasNoDevLogin() throws Exception {
        var response=browser.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/dev/login"))
            .POST(HttpRequest.BodyPublishers.noBody()).build(),HttpResponse.BodyHandlers.ofString());
        assertTrue(response.statusCode()==401||response.statusCode()==403);
    }
    @Test void productionRejectsDevelopmentTokens() throws Exception {
        var response=browser.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/entries/2026-01-01"))
            .header("Authorization","Bearer dev-not-issued").PUT(HttpRequest.BodyPublishers.ofString("{}")).build(),HttpResponse.BodyHandlers.ofString());
        assertEquals(401,response.statusCode());
    }
}
