# Switch to lifestylerx.org

Use the existing health-habits stack and its existing database, accounts and
CloudFront distribution. This is a domain configuration change; publishing the
local UI changes is a separate deployment.

1. In AWS Certificate Manager in **us-east-1 (N. Virginia)**, request a public
   certificate for **lifestylerx.org** with DNS validation and export disabled.
2. At Namecheap, open **lifestylerx.org → Manage → Advanced DNS**. Add the ACM
   validation CNAME. For `_abc.lifestylerx.org`, enter `_abc` as Host; use the full
   ACM target as Value. Keep this record for certificate renewal. Wait for Issued.
3. Update the existing **health-habits** CloudFormation stack with
   **aws/template.json**. Set CustomDomainName to `lifestylerx.org` and
   CustomDomainCertificateArn to the new issued certificate ARN. Preserve all
   other parameter values, especially the current ArtifactKey. The change set
   should modify the distribution and API/Lambda browser origin; it must not
   replace the database, user pool or website bucket. Wait for UPDATE_COMPLETE.
4. In Namecheap Advanced DNS, add an **ALIAS Record** with Host `@` and Value
   `d327h65mh0682m.cloudfront.net` (confirm against the stack's
   CloudFrontDomainName output), TTL Automatic. Inspect existing root A, AAAA,
   ALIAS or URL Redirect records and remove only conflicting parking/website
   records. Preserve email and certificate-validation records. This assumes
   Namecheap manages the authoritative DNS; otherwise use that DNS provider.
5. Verify `https://lifestylerx.org` loads, sign-in works and existing entries
   appear. No data migration is needed. The old health.mckennastuff.com address
   will no longer be a supported alias; this procedure does not set up a redirect.

References:
- https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/add-domain-existing-distribution.html
- https://www.namecheap.com/support/knowledgebase/article.aspx/10128/2237/how-to-create-an-alias-record/
