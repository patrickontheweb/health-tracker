# Updating AWS infrastructure from GitHub

The manual **Preview or apply AWS infrastructure** workflow shares the production
concurrency lock with application deployments. It uses GitHub OIDC credentials;
there are no permanent AWS access keys.

## One-time bootstrap

After any current stack update or deployment finishes, update **health-habits**
through the AWS console using the latest **aws/template.json**, keeping all
existing parameters. The expected change set adds **CloudFormationRole** and
modifies **GitHubDeployRole** and **FunctionRole** (including the username-lookup
read permission). Acknowledge IAM capabilities and wait for
UPDATE_COMPLETE. The resulting **CloudFormationRoleArn** output enables the
workflow; it needs no additional GitHub secret or variable.

## Routine updates

1. Make and test a template change, then push it to main only when publication is
   authorized.
2. Run the infrastructure workflow on main with **operation=preview**. Its run
   summary lists changes and provides a change-set name. It does not execute them.
3. Review that summary. Run the same workflow with **operation=apply** and the
   exact name to apply that preview. The assistant can perform both dispatches
   when the requested infrastructure change has already been authorized.
4. Wait for UPDATE_COMPLETE. If application code also changed, run the application
   deployment workflow afterward.

The preview keeps existing domain, certificate, identity-provider, migration and
other parameter values. It snapshots the actual live Lambda ZIP/JAR and checks
its checksum, because app releases can change code independently of the stack's
ArtifactKey. The preview references that unchanged package to avoid reverting a
previous application release during an infrastructure update.

Apply rejects plans from another stack, another execution role, an older main
commit, or a different application-code version. Removing resources or replacing
the database, user pool, app client or website bucket is blocked. A change needing
those operations must be handled explicitly outside this routine workflow.

The service role can update the existing tracker resources. It has no permission
to delete the data table/user pool/bucket or read habit records. This is not a
general AWS administrator role; new service types may require a reviewed role
permission update. IAM permissions for stack-prefixed roles allow CloudFormation
to maintain the tracker's deployment/function policies.

Reference: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-iam-servicerole.html
