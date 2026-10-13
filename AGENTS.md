# Development and deployment

- Build, test, and preview functionality changes locally by default.
- Keep development changes local until the user asks to publish or deploy them.
- Do not trigger the production AWS workflow or deploy to production unless the
  user explicitly requests a production deployment.
- The GitHub production workflow is manual-only. Do not re-enable deployment on
  push without an explicit user request.
- Local development uses DynamoDB Local and separate development records. Do not
  copy test records into the production database.
