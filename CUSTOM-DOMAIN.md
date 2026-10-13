# health.mckennastuff.com

The custom domain uses the existing S3 website and CloudFront distribution. DNS
stays with the current DNS provider. No database or account data is migrated.

## 1. Request the HTTPS certificate

In AWS Certificate Manager, select **US East (N. Virginia), us-east-1**. CloudFront
requires its ACM certificate in this region. Request a **public certificate** for
`health.mckennastuff.com`, select **DNS validation**, and leave certificate export
disabled. Open the requested certificate to obtain its validation CNAME name and
value. Do not request a private certificate or buy a Namecheap certificate.

## 2. Prove domain ownership with DNS

In Namecheap, open **Domain List → mckennastuff.com → Manage → Advanced DNS**.
Confirm the domain actually uses Namecheap DNS; if its nameservers point elsewhere,
add these records at that DNS provider instead. Do not change nameservers simply
to add this subdomain, since doing so can affect other websites and email.

Add a CNAME using the values from ACM. For example, an ACM name of
`_abc.health.mckennastuff.com` becomes a Namecheap **Host** of `_abc.health`.
The **Value** is the full ACM-provided target ending in `acm-validations.aws`.
Use automatic/default TTL. Keep this record for future automatic certificate
renewals. Wait until ACM shows **Issued**, then copy its ARN.

## 3. Configure CloudFront through the existing stack

First wait for any in-progress `health-habits` stack update to complete. Update
that existing stack with the latest `aws/template.json` and set:

| Parameter | Value |
| --- | --- |
| CustomDomainName | `health.mckennastuff.com` |
| CustomDomainCertificateArn | The issued us-east-1 certificate ARN |
| ArtifactBucket | Keep the existing value |
| ArtifactKey | Keep the current artifact, or the latest successful deployment artifact if auto-deploy has run |
| ExistingGitHubOidcProviderArn | Keep the existing parameter value, including blank if this stack created the provider |

The change set should modify CloudFront, the API's allowed browser origin and
the Lambda website-origin setting. It must not remove or replace the database,
Cognito pool, website bucket or existing identity provider. Submit and wait for
**UPDATE_COMPLETE**. Both custom-domain parameters default to blank, so the
template continues using the existing CloudFront address until explicitly enabled.

## 4. Point the subdomain to CloudFront

Add this CNAME at the DNS provider:

| Type | Host | Value |
| --- | --- | --- |
| CNAME | `health` | The stack's `CloudFrontDomainName` output |

Use the hostname alone, without `https://` or a path. The current distribution is
`d327h65mh0682m.cloudfront.net`; prefer the actual stack output when entering it.
If a `health` record already exists, inspect it before replacing it. Leave the
root domain, email records and other subdomains unchanged.

## 5. Verify

Open `https://health.mckennastuff.com`, verify HTTPS, public history, sign-in and a
saved edit across devices. DNS propagation can take time. The old CloudFront
address still serves static files, but the API now allows browser requests from
the custom domain; use the new address for viewing and editing.

The GitHub deployment script reads `WebsiteUrl` from stack outputs, so its website
checks and run summaries automatically use the new address. Finish the separate
AWS_DEPLOY_ROLE_ARN setup described in AUTO-DEPLOY.md to enable automatic deploys.

References:
- https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cnames-and-https-requirements.html
- https://docs.aws.amazon.com/acm/latest/userguide/dns-validation.html
- https://www.namecheap.com/support/knowledgebase/article.aspx/9646/2237/how-to-create-a-cname-record-for-your-domain/
