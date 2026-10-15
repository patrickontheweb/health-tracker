package com.example.habits;
import java.util.Map;
public interface EntryRepository {
    Map<String, Entry> week(String start, String end);
    Entry save(String day, long cardio, long lifting, long produce, long expectedRevision);
    Entry save(String day, long cardio, long lifting, long produce, long expectedRevision, Long weight);
    Map<String,Entry> weekForUser(String user,String start,String end);
    Entry saveForUser(String user,String day,long cardio,long lifting,long produce,long expectedRevision,Long weight);
    Entry saveMeasurements(String user,String day,Entry entry,long expectedRevision);
    String publicUser(String username);
    void ensureProfile(String user,String username);
    Goals goals(String user);
    Goals saveGoals(String user,Goals goals);
}
