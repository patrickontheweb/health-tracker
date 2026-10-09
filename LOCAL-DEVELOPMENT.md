# Local development on Windows

The live tracker keeps using DynamoDB in AWS. Local development uses **DynamoDB
Local**, AWS's downloadable development database. Local records persist on disk
and never get uploaded to the live table. No real AWS credentials or AWS CLI are
needed for the local database. Java 21 runs both DynamoDB Local and Spring Boot;
Docker is optional and is not required by these instructions.

Use three PowerShell terminals, starting in the project directory:

1. **Database:** `powershell -ExecutionPolicy Bypass -File scripts/start-db.ps1`
   The script downloads DynamoDB Local on first use and verifies its published
   SHA-256 checksum. Leave the terminal running. Development records are stored
   under `.local-data/dynamodb/`, which Git ignores.
2. **Backend:** `powershell -ExecutionPolicy Bypass -File scripts/start-backend.ps1 -UserPoolId YOUR_EXISTING_POOL_ID`
   Find the pool ID in the `health-habits` CloudFormation stack's `UserPoolId`
   output. The script builds Spring Boot and starts the API at
   `http://127.0.0.1:8080`. It creates the `health-habits-dev` table if absent,
   preserving existing local records. Without `-UserPoolId`, public reads work
   but Cognito editing is not configured.
3. **Angular:** `powershell -ExecutionPolicy Bypass -File scripts/start-frontend.ps1`
   Open **http://127.0.0.1:4200**. Development builds use the local
   API automatically; production builds retain the AWS configuration.

This desktop already has portable Java 21 and Maven under `.tools/`, plus bundled
pnpm; the scripts find them automatically. On another machine install Java 21, Maven 3.9, Node 24
and pnpm 11. Set `JAVA_HOME` to Java 21.

Sign in using the existing Cognito username/password. This requires internet for
sign-in and token verification; daily entries are stored in the **local** database.
The production API and its records remain separate. Refreshing or reopening the
page requires signing in again, as on the live site.

Stop each terminal with Ctrl+C. Restarting the database preserves its records.
There is no automatic copying between local data and production.

## Learning the table

There is one table, with two key attributes:

| Attribute | Meaning |
| --- | --- |
| `log` | Partition key; `main` is our shared habit log |
| `day` | Sort key; a date such as `2026-10-09` |
| `cardio` | Minutes for that day |
| `lifting` | Number of sessions |
| `produce` | Number of fruit/vegetable servings |
| `revision` | Version used to prevent one editor overwriting another's changes |

The repository queries `log=main` with a date range to load a week. A conditional
write compares `revision` before saving; a stale editor receives HTTP 409. Both
environments use the same repository and AWS SDK calls. The local Spring profile
sets a loopback endpoint and dummy credentials; production uses the normal AWS
endpoint and Lambda role. Table creation runs only in the local profile.

## Tests

Run `mvn verify` in `backend/` for the regular tests. With DynamoDB Local running,
set `$env:DYNAMODB_TEST_ENDPOINT='http://127.0.0.1:8000'` before running Maven to
include the integration tests. They use a uniquely named temporary table, which
is deleted afterward; they do not use `health-habits-dev` or the AWS table.

AWS reference: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.DownloadingAndRunning.html
