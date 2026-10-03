# Security & data-compliance review — 2026-10-03

## Scope and snapshot

- Project: `support-reply-assistant`
- Commit: `0c329ece690e0916e16e14a0a4b4b1d5e53d5878`
- Environment: local PostgreSQL configured by ignored `.env.local`; the requester states that this knowledge library is identical to deploy.
- Scope: published knowledge articles and chunks, import metadata, and scans for prohibited company branding, common secret signatures, and common personal-data patterns.
- Safety: the initial audit was read-only; the later user-authorized remediation sanitized matching local records. IDs and source metadata are represented by one-way short hashes; no credentials or raw sensitive values are included.

## Results

| Check | Result | Evidence |
| --- | --- | --- |
| Knowledge corpus accessible | PASS | 47 articles, 48 chunks; all 47 articles are `published`. |
| Prohibited company-brand scan | PASS after remediation | Retest found zero matches in article content and metadata. |
| Common secret signatures | PASS | No OpenAI/Gemini/AWS/GitHub/private-key signature detected in article bodies. |
| Common PII patterns | PASS, limited | No phone number, email address, 9–12 digit identifier, or listed sensitive-identity term detected in article bodies. |
| Retrieval and import lineage | PASS after remediation | Retest found zero matches in chunks, import batches, import rows, and article-audit records. |

## Findings

### SEC-012 — Published knowledge articles retain prohibited company branding

- Severity: High
- Status: VERIFIED
- Confidence: High
- Scope: local knowledge library, stated to match deploy.
- Evidence: 46 of 47 article records match in content or metadata; 3 published and verified article bodies match directly, with redacted identifiers `bb8668f8fa`, `7aef01ddeb`, and `13408d1377`. These 3 share source-file hash `2413f51543`. A full relational scan also found 6 matching retrieval chunks, 1 matching import batch, 7 matching import rows, and 3 matching article-audit records.
- Impact: the assistant can retrieve and return company-specific material to users. Import/audit metadata also preserves the prohibited reference, so editing visible article text alone would leave the library non-compliant.
- Remediation performed: under explicit authorization, deleted the prior knowledge library and its related chunks, tags, categories, import records, audit records, and merge metadata. It was replaced with 47 fully synthetic articles and 47 synthetic chunks. Every replacement article has a `synthetic:` source key and `synthetic-library.xlsx` source filename.
- Retest: 47/47 articles are synthetic; all content is ASCII-only, and zero matches remain for the ASCII brand variant in articles or chunks. There are zero import batches, import rows, and article-audit records. The export contains all 47 published articles in the official seven-column import shape.

## Limits / not run

- This review did not semantically classify every generic technical instruction as public versus internal; generic titles alone are insufficient evidence. The shared import lineage is a concrete reason to review the complete source batch.
- Pattern-based PII/secret scans cannot prove the absence of every sensitive value or obfuscated secret.
- Docker Compose runtime validation was not run because Docker CLI is unavailable in this environment.
