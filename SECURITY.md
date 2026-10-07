# Security Policy

## Reporting a vulnerability

Please do not open a public GitHub issue for a security vulnerability. Instead, use GitHub's private security advisory feature for this repository.

Include the affected version, a minimal reproduction, impact, and any suggested remediation. Please avoid including real MailBluster API keys or subscriber data in reports.

## Credential handling

The node stores the MailBluster API key through n8n's credential system and sends it only in the `Authorization` header to `https://api.mailbluster.com`.
