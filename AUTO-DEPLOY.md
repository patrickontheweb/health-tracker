# Automatic deployment from main

Every push to `main` runs `.github/workflows/deploy.yml`. It tests Angular and the
Spring Boot API (including DynamoDB Local), builds both, and deploys only after
the checks pass. Manual runs are also available through the Actions tab on `main`.

GitHub uses short-lived AWS credentials through OIDC. The AWS trust policy is
limited to this repository's immutable owner/repository IDs and `main`. This
repository was created after GitHub's July 2026 OIDC subject-format change.
No AWS access keys or GitHub personal access token are required by the workflow.

## One-time setup

1. In AWS **IAM → Identity providers**, check whether
   `token.actions.githubusercontent.com` already exists. If it does, copy its ARN.
2. In **CloudFormation → health-habits → Update stack**, replace the template with
   `aws/template.json`. Keep the current `ArtifactBucket` and `ArtifactKey` values.
   Leave `ExistingGitHubOidcProviderArn` blank if the provider does not exist;
   otherwise enter its ARN. Acknowledge IAM resource creation. Review the change
   set: it should add the deployment role and, if needed, the OIDC provider.
   Existing application resources must not be removed or replaced. Submit and
   wait for `UPDATE_COMPLETE`.
3. Copy **GitHubDeployRoleArn** from the stack's Outputs tab.
4. In GitHub **health-tracker → Settings → Secrets and variables → Actions →
   Variables**, create a repository variable named **AWS_DEPLOY_ROLE_ARN**, using
   that ARN as its value. It is a public identifier, so use a variable, not a secret.
5. In the GitHub Actions tab, run **Test and deploy to AWS** on `main` (or push a
   new commit). Confirm all steps pass and verify a public read plus a signed-in
   edit in the live site. Until this first real run passes, deployment is unverified.

To push a workflow file using your fine-grained GitHub token, the token needs
**Workflows: read and write** in addition to its existing Contents permission.
The token remains stored in Windows Credential Manager; it is not used by Actions.

## What changes during deployment

The deployment reads stack outputs to identify the exact Lambda function, private
website bucket and CloudFront distribution. It regenerates `config.json` from
those outputs, so local development settings cannot get uploaded accidentally.

Each run saves the current Lambda JAR and the new JAR under a unique
`releases/COMMIT/RUN-ATTEMPT/` prefix in `pcmckenna-health`. It updates Lambda using
its revision ID, waits for the update, and smoke-tests the public API. If the
backend update or that check fails before website upload, it attempts to restore
the prior JAR and leaves the website unchanged.

New website assets are uploaded first, then configuration and `index.html` last.
Old hashed assets are retained for already-open browsers. The workflow invalidates
CloudFront, waits, and checks the served page against the new build. A successful
run stores a deployment manifest and links the live website in its run summary.
Concurrent deployments are serialized; an active deployment is not canceled by
a later push. GitHub may replace older pending runs with the latest pending run.

The role has no DynamoDB or Cognito access and cannot change IAM or application
infrastructure. Automatic deployment changes application code and website files;
changes to CloudFormation infrastructure still require a separate console update.

Lambda code updates run directly, rather than granting the pipeline broad
CloudFormation update permissions. Consequently the stack's `ArtifactKey`
parameter still names the original/manual artifact. Before a future infrastructure
update that modifies Lambda, set that parameter to the **latest successful**
`artifactKey` in the deployment manifest/run summary to avoid redeploying old code.

API and website deployment is not an atomic transaction. If website upload or its
verification fails after the backend passes, inspect the failed run and rerun it;
the workflow does not automatically roll the two components back at that point.
To undo a successful release, revert its source commit on `main`; the normal
workflow rebuilds and deploys that revert. Stored release artifacts and old hashed
website assets incur small S3 storage charges; no extra always-running service is
added. No IAM setup or deployment has occurred merely by adding these files.

References:
- https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws
- https://github.com/aws-actions/configure-aws-credentials
