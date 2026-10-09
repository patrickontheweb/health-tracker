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
    public EntriesController(EntryRepository repository) { this.repository = repository; }
    static LocalDate parseDay(String value) {
        if (value == null || !value.matches("\\d{4}-\\d{2}-\\d{2}")) throw new IllegalArgumentException();
        return LocalDate.parse(value);
    }
    @GetMapping("/entries") public ResponseEntity<?> week(@RequestParam String week) {
        LocalDate start = parseDay(week);
        if (start.getDayOfWeek().getValue() != 1) throw new IllegalArgumentException();
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(Map.of("entries", repository.week(start.toString(), start.plusDays(6).toString())));
    }
    @PutMapping("/entries/{day}") public ResponseEntity<?> save(@PathVariable String day, @RequestBody Map<String, Object> body) {
        LocalDate date = parseDay(day);
        if (date.isAfter(LocalDate.now(ZoneOffset.UTC).plusDays(1))) throw new IllegalArgumentException();
        if (!body.keySet().equals(Set.of("cardio", "lifting", "produce", "expectedRevision"))) throw new IllegalArgumentException();
        Entry entry = repository.save(date.toString(), integer(body.get("cardio")), integer(body.get("lifting")), integer(body.get("produce")), integer(body.get("expectedRevision")));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(Map.of("entry", entry));
    }
    static long integer(Object value) {
        if (!(value instanceof Integer || value instanceof Long)) throw new IllegalArgumentException();
        long number = ((Number) value).longValue();
        if (number < 0 || number > 9007199254740990L) throw new IllegalArgumentException();
        return number;
    }
}
