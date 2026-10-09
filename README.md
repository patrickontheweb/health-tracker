# Daily practice

A small tracker with an **Angular front end** and a **Spring Boot API**.

- Cardiovascular exercise: **150 minutes per Monday–Sunday week**.
- Weightlifting: **two sessions per week**.
- Fruit and/or vegetables: **five servings per day**.
- One shared log: anyone can view it; editor accounts can save changes.
- Enter daily totals, select dates to view or edit past days, and refresh to see changes made on another device.

## Project

| Folder | Purpose |
| --- | --- |
| `frontend/` | Angular 21 standalone app, forms, signals, services and lockfile |
| `backend/` | Spring Boot 4 / Java 21, Spring Security, DynamoDB repository and tests |
| `aws/template.json` | CloudFormation template to upload in AWS |
| `release/` | Built website ZIP and Spring Boot Lambda JAR |
| `LEARNING.md` | Where to start reading and changing the Angular code |

The Angular app compiles to static files for S3. CloudFront serves them over HTTPS. API Gateway routes requests to Spring Boot on Lambda; DynamoDB stores history; Cognito handles username/password sign-in. AWS supports Spring Boot on Lambda through its [Java container adapter](https://github.com/aws/serverless-java-container/wiki/Quick-start---Spring-Boot4).

The tracker is deployed to AWS. Shared history lives in DynamoDB, and no password or AWS credential is embedded in the page. This repository contains source and deployment instructions; generated builds and local database files are excluded from Git.

## Preview

For development, follow [LOCAL-DEVELOPMENT.md](LOCAL-DEVELOPMENT.md): run DynamoDB Local, the Spring Boot API and Angular in three terminals. Development builds use the local API and separate persistent local records; production builds use the AWS configuration.

To preview the production build, run `pnpm build` in `frontend/`, then `node server.mjs` from this directory and open http://127.0.0.1:4173. This preview connects to the live AWS API, so signed-in changes affect the live log.

## Deploy through the AWS console

Use one AWS region throughout, for example `us-east-1`.

1. In S3, use an existing private bucket or create one for deployment artifacts. Upload `release/health-habits-api-lambda.jar` with object key `health-habits-api-lambda.jar`.
2. In CloudFormation, create a stack by uploading `aws/template.json`. Enter the artifact bucket name and JAR key. Acknowledge the IAM resources and create the stack. This creates a **separate** private website bucket, CloudFront distribution, API, table and sign-in resources. CloudFront creation can take several minutes.
3. Open the stack's **Outputs** tab. Save `WebsiteUrl`, `WebsiteBucket`, `ApiUrl`, `Region`, `ClientId` and `UserPoolId`.
4. Extract `release/health-habits-website.zip` and edit `config.json` using the outputs:

   ```json
   {
     "apiUrl": "https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com",
     "region": "us-east-1",
     "clientId": "YOUR_COGNITO_CLIENT_ID"
   }
   ```

   These values are public configuration. Also copy them into `frontend/public/config.json` for future builds. Never put a password or AWS access key here.

5. Upload **all extracted website files** to the root of the bucket named by `WebsiteBucket`. Keep public-access blocking enabled: CloudFront already has access. Content types should be `.html` = `text/html`, `.js` = `text/javascript`, `.css` = `text/css`, `.json` = `application/json`; S3 normally detects them.
6. In Cognito, open the pool identified by `UserPoolId`. Create an editor user with a username and temporary password. Self-registration is disabled. Keep password-based sign-in and no additional required attributes. The page supports the first-login password-change prompt. Permanent passwords require at least 12 characters, uppercase, lowercase, a number and a symbol. All users you create in this pool can edit the shared log.
7. Open `WebsiteUrl`, sign in and save a day. Open the same URL on another device to confirm it shows the saved history. Use the HTTPS CloudFront address rather than an HTTP S3 website endpoint.

After website updates, upload a new build and invalidate `/*` in CloudFront, or wait for the short cache period. For API updates, upload a uniquely named JAR and update the stack's `ArtifactKey` parameter.

## Build and test

Use Node.js 24, pnpm 11, Java 21 and Maven 3.9. No global Angular CLI is required.

```powershell
# In frontend/
pnpm install --frozen-lockfile
pnpm test
pnpm build

# In backend/
mvn --batch-mode --no-transfer-progress verify
```

Website output: `frontend/dist/health-habits/browser/`.

Lambda JAR: `backend/target/health-habits-api-1.0.0-lambda.jar`.

Regular executable Spring Boot JAR: `backend/target/health-habits-api-boot.jar`.

To run Spring Boot normally, set `TABLE_NAME`, `AWS_REGION`, `COGNITO_ISSUER`, `CLIENT_ID` and `WEBSITE_ORIGIN`, and run the executable JAR with `java -jar`. Use your normal AWS credential provider for DynamoDB access. The issuer is `https://cognito-idp.REGION.amazonaws.com/USER_POOL_ID`. For local editing, run Spring Boot locally, allow the exact Angular origin you use (localhost or 127.0.0.1 on port 4200), and point Angular's config at it. Production API Gateway CORS allows the CloudFront URL only.

## API and storage

- `GET /entries?week=YYYY-MM-DD`: one Monday–Sunday week, public.
- `PUT /entries/YYYY-MM-DD`: requires a Cognito access token for this client and its scope, checked by API Gateway and Spring Security.
- Writes include `expectedRevision`. A stale editor gets HTTP 409 instead of overwriting another device's update.
- Values must be nonnegative whole numbers. Progress derives from saved daily totals.
- History is intentionally public. Usernames and passwords are not returned in the log. Tokens stay in memory and expire after one hour. Reopening or refreshing a page requires signing in again. Logout clears the current browser's token; already-issued JWTs are accepted by the API until expiry.
- DynamoDB point-in-time recovery is enabled. The table is retained if the stack is deleted; retained resources continue to incur applicable charges. API throttling is enabled. AWS usage determines cost. Local DynamoDB does not incur AWS database charges.

Local verification covers Angular compilation and habit/date tests, Spring Boot tests including Lambda startup and rejected anonymous writes, and DynamoDB Local integration tests for persisted records and conditional writes. Real Cognito sign-in, public viewing across devices and saved edits have also been verified on the existing AWS deployment.

The optional browser WebMCP tool exposes public reads only. Its registration and input validation passed local stub tests; a native WebMCP-enabled browser was not available for live validation.

