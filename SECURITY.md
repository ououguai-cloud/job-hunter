# Security Policy

## Scope

JobHunter is designed for local use. It stores resume profile data, application
history, and optional browser login state on the machine that runs it.

The server listens on `127.0.0.1` by default. Do not set `HOST` to a LAN or
public address unless you understand the privacy and authentication risks.

## Before publishing a fork

- Keep `resume/profile.json`, any `resume` backups, `data/applications*.json`,
  `db/jobs_custom.json`, `.profile/`, and screenshots with personal data out of
  version control.
- Review `git status --ignored` and `git diff --cached` before every push.
- Rotate any credentials that were accidentally committed before making a
  repository public.

## Responsible disclosure

Do not publish sensitive vulnerabilities in a public issue. Contact the
maintainer privately with a reproducible report, affected version, and impact.

## Automation boundaries

The application requires a user-provided CAPTCHA response and an explicit
confirmation before submission. Use it only where the target site's terms and
recruitment process allow it.
