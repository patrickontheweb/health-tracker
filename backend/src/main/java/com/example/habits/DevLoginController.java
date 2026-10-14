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
    private record Session(String subject,Instant expiry){}
    private final Map<String,Session> tokens=new ConcurrentHashMap<>();
    public DevLoginController(@Value("${habits.endpoint}") String endpoint) {
        DynamoClients.localEndpoint(endpoint);
        if(System.getenv("AWS_LAMBDA_FUNCTION_NAME")!=null) throw new IllegalStateException("Dev login cannot run in Lambda");
    }
    @PostMapping("/dev/login") public ResponseEntity<?> login(@org.springframework.web.bind.annotation.RequestBody(required=false) Map<String,String> body) {
        String user=body==null?"local-developer":body.getOrDefault("user","local-developer");
        if(!user.matches("local-[a-zA-Z0-9_-]{1,64}"))throw new IllegalArgumentException();
        Instant now=Instant.now();tokens.entrySet().removeIf(e->!e.getValue().expiry().isAfter(now));
        String token="dev-"+UUID.randomUUID()+UUID.randomUUID();tokens.put(token,new Session(user,now.plusSeconds(3600)));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(Map.of("AuthenticationResult",Map.of("AccessToken",token,"ExpiresIn",3600)));
    }
    Jwt decode(String token) {
        Session session=tokens.get(token);
        if(session==null||!session.expiry().isAfter(Instant.now()))return null;
        Instant expiry=session.expiry();
        return Jwt.withTokenValue(token).header("alg","local-only").subject(session.subject())
            .issuedAt(expiry.minusSeconds(3600)).expiresAt(expiry)
            .claim("username",session.subject().equals("local-developer")?"pcmckenna":session.subject().substring(6))
            .claim("scope","aws.cognito.signin.user.admin").build();
    }
}
