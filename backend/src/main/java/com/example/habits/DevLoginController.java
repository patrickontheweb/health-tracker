package com.example.habits;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/** Ephemeral development tokens, available only with a loopback development database. */
@RestController
@Profile("local & !production")
@ConditionalOnProperty(name="habits.local",havingValue="true")
public class DevLoginController {
    private final Map<String,Instant> tokens=new ConcurrentHashMap<>();
    public DevLoginController(@Value("${habits.endpoint}") String endpoint) {
        DynamoClients.localEndpoint(endpoint);
        if(System.getenv("AWS_LAMBDA_FUNCTION_NAME")!=null) throw new IllegalStateException("Dev login cannot run in Lambda");
    }
    @PostMapping("/dev/login") public ResponseEntity<?> login() {
        Instant now=Instant.now();tokens.entrySet().removeIf(e->!e.getValue().isAfter(now));
        String token="dev-"+UUID.randomUUID()+UUID.randomUUID();tokens.put(token,now.plusSeconds(3600));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(Map.of("AuthenticationResult",Map.of("AccessToken",token,"ExpiresIn",3600)));
    }
    Jwt decode(String token) {
        Instant expiry=tokens.get(token);
        if(expiry==null||!expiry.isAfter(Instant.now()))return null;
        return Jwt.withTokenValue(token).header("alg","local-only").subject("local-developer")
            .issuedAt(expiry.minusSeconds(3600)).expiresAt(expiry)
            .claim("scope","aws.cognito.signin.user.admin").build();
    }
}
