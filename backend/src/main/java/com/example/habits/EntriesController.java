package com.example.habits;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Set;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
@RestController
public class EntriesController {
    private final EntryRepository repository;
    private final LogOwner owner;
    public EntriesController(EntryRepository repository,LogOwner owner) { this.repository = repository;this.owner=owner; }
    static LocalDate parseDay(String value) {
        if (value == null || !value.matches("\\d{4}-\\d{2}-\\d{2}")) throw new IllegalArgumentException();
        return LocalDate.parse(value);
    }
    @GetMapping("/entries") public ResponseEntity<?> week(@RequestParam String week,@org.springframework.security.core.annotation.AuthenticationPrincipal org.springframework.security.oauth2.jwt.Jwt jwt) {
        LocalDate start = parseDay(week);
        if (start.getDayOfWeek().getValue() != 1) throw new IllegalArgumentException();
        return readOwn(jwt,start);
    }
    private ResponseEntity<?> readOwn(org.springframework.security.oauth2.jwt.Jwt jwt,LocalDate start){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(Map.of("entries",repository.weekForUser(jwt.getSubject(),start.toString(),start.plusDays(6).toString()),"goals",goalsFor(jwt.getSubject()),"username",DynamoEntryRepository.publicName(jwt.getClaimAsString("username"))));}
    private ResponseEntity<?> read(String user,LocalDate start){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(Map.of("entries",repository.weekForUser(user,start.toString(),start.plusDays(6).toString()),"goals",goalsFor(user)));}
    @GetMapping("/me/profile") public ResponseEntity<?> profile(@org.springframework.security.core.annotation.AuthenticationPrincipal org.springframework.security.oauth2.jwt.Jwt jwt){String name=DynamoEntryRepository.publicName(jwt.getClaimAsString("username"));repository.ensureProfile(jwt.getSubject(),name);return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(Map.of("username",name,"goals",goalsFor(jwt.getSubject())));}
    private Goals goalsFor(String user){Goals goals=repository.goals(user);return goals==null?Goals.DEFAULT:goals;}
    @GetMapping("/me/settings") public ResponseEntity<?> settings(@org.springframework.security.core.annotation.AuthenticationPrincipal org.springframework.security.oauth2.jwt.Jwt jwt){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(goalsFor(jwt.getSubject()));}
    @PutMapping("/me/settings") public ResponseEntity<?> saveSettings(@RequestBody Map<String,Object> body,@org.springframework.security.core.annotation.AuthenticationPrincipal org.springframework.security.oauth2.jwt.Jwt jwt){
        if(!body.keySet().equals(Set.of("produce","lifting","cardio")))throw new IllegalArgumentException();
        Goals goals=new Goals(integer(body.get("produce")),integer(body.get("lifting")),integer(body.get("cardio")));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(repository.saveGoals(jwt.getSubject(),goals));
    }
    @GetMapping("/users/{username}/entries") public ResponseEntity<?> publicWeek(@PathVariable String username,@RequestParam String week){
        LocalDate start=parseDay(week);if(start.getDayOfWeek().getValue()!=1)throw new IllegalArgumentException();
        String user=repository.publicUser(username);if(user==null)throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND,"User not found");return read(user,start);
    }
    @GetMapping("/me/entries") public ResponseEntity<?> ownWeek(@RequestParam String week,@org.springframework.security.core.annotation.AuthenticationPrincipal org.springframework.security.oauth2.jwt.Jwt jwt){LocalDate start=parseDay(week);if(start.getDayOfWeek().getValue()!=1)throw new IllegalArgumentException();return readOwn(jwt,start);}
    @PutMapping("/entries/{day}") public ResponseEntity<?> save(@PathVariable String day, @RequestBody Map<String, Object> body,@org.springframework.security.core.annotation.AuthenticationPrincipal org.springframework.security.oauth2.jwt.Jwt jwt) {return saveFor(jwt.getSubject(),day,body);}
    @PutMapping("/me/entries/{day}") public ResponseEntity<?> ownSave(@PathVariable String day,@RequestBody Map<String,Object> body,@org.springframework.security.core.annotation.AuthenticationPrincipal org.springframework.security.oauth2.jwt.Jwt jwt){return saveFor(jwt.getSubject(),day,body);}
    ResponseEntity<?> saveFor(String user,String day,Map<String,Object> body){
        LocalDate date = parseDay(day);
        if (date.isAfter(LocalDate.now(ZoneOffset.UTC).plusDays(1))) throw new IllegalArgumentException();
        if(!body.keySet().containsAll(Set.of("cardio","lifting","produce","expectedRevision"))||!Set.of("cardio","lifting","produce","expectedRevision","weight","systolic","diastolic","heartRate","sleepHours","calories","sugarGrams","saturatedFatGrams","sodiumMg").containsAll(body.keySet()))throw new IllegalArgumentException();
        long cardio=integer(body.get("cardio")),lifting=integer(body.get("lifting")),produce=integer(body.get("produce")),revision=integer(body.get("expectedRevision"));
        Long weight=body.get("weight")==null?null:integer(body.get("weight"));
        if(weight!=null&&(weight<1||weight>999))throw new IllegalArgumentException();
        Long systolic=measurement(body.get("systolic")),diastolic=measurement(body.get("diastolic")),heartRate=measurement(body.get("heartRate"));
        Double sleep=sleep(body.get("sleepHours"));
        Long calories=nutritionInteger(body.get("calories")),sodium=nutritionInteger(body.get("sodiumMg"));
        Double sugar=decimal(body.get("sugarGrams"),9999),fat=decimal(body.get("saturatedFatGrams"),9999);
        if(body.keySet().stream().anyMatch(Set.of("systolic","diastolic","heartRate","sleepHours","calories","sugarGrams","saturatedFatGrams","sodiumMg")::contains)){
            Entry previous=repository.weekForUser(user,day,day).get(day);
            if(previous!=null){if(!body.containsKey("weight"))weight=previous.weight();if(!body.containsKey("systolic"))systolic=previous.systolic();if(!body.containsKey("diastolic"))diastolic=previous.diastolic();if(!body.containsKey("heartRate"))heartRate=previous.heartRate();if(!body.containsKey("sleepHours"))sleep=previous.sleepHours();}
            if(previous!=null){if(!body.containsKey("calories"))calories=previous.calories();if(!body.containsKey("sugarGrams"))sugar=previous.sugarGrams();if(!body.containsKey("saturatedFatGrams"))fat=previous.saturatedFatGrams();if(!body.containsKey("sodiumMg"))sodium=previous.sodiumMg();}
            Entry entry=repository.saveMeasurements(user,day,new Entry(cardio,lifting,produce,0,weight,systolic,diastolic,heartRate,sleep,calories,sugar,fat,sodium),revision);
            return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(Map.of("entry",entry));
        }
        if(!body.containsKey("weight")){Entry previous=repository.weekForUser(user,day,day).get(day);weight=previous==null?null:previous.weight();}
        Entry entry = repository.saveForUser(user,date.toString(),cardio,lifting,produce,revision,weight);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(Map.of("entry", entry));
    }
    static long integer(Object value) {
        if (!(value instanceof Integer || value instanceof Long)) throw new IllegalArgumentException();
        long number = ((Number) value).longValue();
        if (number < 0 || number > 9007199254740990L) throw new IllegalArgumentException();
        return number;
    }
    static Long measurement(Object value){if(value==null)return null;long number=integer(value);if(number<1||number>999)throw new IllegalArgumentException();return number;}
    static Double sleep(Object value){return decimal(value,24);}
    static Long nutritionInteger(Object value){if(value==null)return null;long n=integer(value);if(n>99999)throw new IllegalArgumentException();return n;}
    static Double decimal(Object value,double max){if(value==null)return null;if(!(value instanceof Number number))throw new IllegalArgumentException();double n=number.doubleValue();if(!Double.isFinite(n)||n<0||n>max||Math.abs(n*10-Math.rint(n*10))>0.000001)throw new IllegalArgumentException();return n;}
}
