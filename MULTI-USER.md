# User accounts and public username pages

This version is local until deployment is explicitly requested. Withings is not
implemented or required.

- `/` requires login and shows the signed-in user's own records.
- `/pcmckenna` shows that user's records publicly and cannot be edited anonymously.
- `/pcmckenna/10132026` selects October 13, 2026 (MMDDYYYY).
- Public usernames are case-insensitive and come from the verified Cognito username.
- A logged-in user can edit their own page, but another user's page stays read-only.
- New accounts can be created in the existing Cognito user pool's Users page.
  Self-registration, password recovery and clinician roles are not included yet.

Records use the existing table with `log=user#<Cognito sub>` and `day=YYYY-MM-DD`.
The authenticated subject, never a body parameter or public username, determines
the write partition. Username-to-sub mappings are metadata records with
`log=profile#<username>` and `day=~profile`. They do not appear in date queries.
Anonymous reads require the public username endpoint. There is no user directory.

## Local development

The regular local Login button signs in as `local-developer`, public name
`pcmckenna`. Startup copies the old `main` records into that partition and keeps
all original records. Copying is idempotent and never overwrites existing user
records. This migration uses DynamoDB Local only.

For automated multi-user tests, POST `/dev/login` with `{"user":"local-alice"}`
issues an ephemeral local token for Alice. This capability is restricted to the
local profile, loopback database, and non-Lambda runtime. It does not exist in
production.

## Before a production deployment

1. In Cognito, open the existing `pcmckenna` user and copy the immutable **sub**
   attribute. Do not use the user-pool ID, app-client ID or username for this value.
2. Update the existing CloudFormation stack with `aws/template.json`, preserving
   its domain, certificate and artifact parameters. Set **LegacyLogOwnerSub** to
   that sub and **LegacyLogOwnerUsername** to `pcmckenna`.
3. Review the change set: the table and user pool must not be replaced or deleted.
   The update adds authenticated/private and public-username routes, a health
   check route, and CloudFront support for direct page URLs.
4. Deploy the tested app through the manual GitHub workflow. It refuses to deploy
   until the stack has the new records mode and an explicit legacy owner.
5. Verify login, `/pcmckenna`, date URLs, saved weights/servings and a second
   account. The original `main` records remain as a fallback copy. User changes
   after migration are written only to their new partitions.

Public username pages expose all saved fields, including weight. This matches the
current public-view requirement; an account privacy setting can be added later.
