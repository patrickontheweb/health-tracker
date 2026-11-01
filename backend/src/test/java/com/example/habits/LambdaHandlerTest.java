package com.example.habits;
import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class LambdaHandlerTest {
    private static final java.util.Map<String,String> previousProperties=new java.util.HashMap<>();
    @BeforeAll static void configure() {
        java.util.Map.of("habits.table","unused-test-table",
            "habits.issuer","https://cognito-idp.us-east-1.amazonaws.com/test",
            "habits.client-id","test-client","habits.origin","http://localhost:4200",
            "aws.region","us-east-1").forEach((key,value)->{
                previousProperties.put(key,System.getProperty(key));System.setProperty(key,value);
            });
    }
    @AfterAll static void restoreProperties() {
        previousProperties.forEach((key,value)->{if(value==null)System.clearProperty(key);else System.setProperty(key,value);});
    }
    String call(String method,String path,String query) throws Exception {
        Context context=mock(Context.class);when(context.getLogger()).thenReturn(mock(LambdaLogger.class));when(context.getAwsRequestId()).thenReturn("test-request");when(context.getRemainingTimeInMillis()).thenReturn(30000);
        String event="""
            {"version":"2.0","routeKey":"$default","rawPath":"%s","rawQueryString":"%s","headers":{"host":"localhost","content-type":"application/json"},"requestContext":{"accountId":"test","apiId":"test","domainName":"localhost","domainPrefix":"test","requestId":"test-request","routeKey":"$default","stage":"$default","time":"01/Jan/2026:00:00:00 +0000","timeEpoch":1767225600000,"http":{"method":"%s","path":"%s","protocol":"HTTP/1.1","sourceIp":"127.0.0.1","userAgent":"test"}},"isBase64Encoded":false,"body":"{}"}
            """.formatted(path,query,method,path);
        ByteArrayOutputStream output=new ByteArrayOutputStream();new LambdaHandler().handleRequest(new ByteArrayInputStream(event.getBytes(StandardCharsets.UTF_8)),output,context);return output.toString(StandardCharsets.UTF_8);
    }
    @Test void anonymousPrivateReadsAreBlocked() throws Exception {assertTrue(call("GET","/entries","week=invalid").contains("\"statusCode\":401"));}
    @Test void anonymousWritesAreBlocked() throws Exception {assertTrue(call("PUT","/entries/2026-01-01","").contains("\"statusCode\":401"));}
}
