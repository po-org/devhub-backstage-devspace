# http-pretty-output

A Red Hat Developer Hub (RHDH) dynamic backend plugin that formats and outputs
JSON from previous scaffolder steps in a readable, pretty-printed form.

This action behaves like `debug:log`, but is designed specifically for
structured API responses (GitHub, Ansible, REST APIs, etc).

## Why this exists

- Keep `http:backstage:request` unchanged
- Avoid passing secrets or tokens
- Improve readability of API responses
- Enable step-to-step inspection during scaffolding

## Action ID

