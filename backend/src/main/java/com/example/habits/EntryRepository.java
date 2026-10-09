package com.example.habits;
import java.util.Map;
public interface EntryRepository {
    Map<String, Entry> week(String start, String end);
    Entry save(String day, long cardio, long lifting, long produce, long expectedRevision);
}
