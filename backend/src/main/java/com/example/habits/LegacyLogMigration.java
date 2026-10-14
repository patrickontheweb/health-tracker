package com.example.habits;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Value;
@Component
public class LegacyLogMigration {
    public LegacyLogMigration(EntryRepository repository,LogOwner owner,@Value("${habits.migrate-legacy:false}") boolean migrate,@Value("${habits.owner-username:}") String username){if(migrate&&repository instanceof DynamoEntryRepository dynamo){dynamo.copyLegacyToUser(owner.subject());if(!username.isBlank())dynamo.ensureProfile(owner.subject(),username);}}
}
