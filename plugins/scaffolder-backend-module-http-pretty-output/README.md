# Scaffolder Backend Module: HTTP Pretty Output

This Backstage scaffolder action formats the output of a previous HTTP request step into human-readable JSON.  

It is designed to work with `http:backstage:request` or any HTTP step in your scaffolder template.

---

## Installation

```bash
cd packages/backend
yarn add @internal/scaffolder-backend-module-http-pretty-output


apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: github-pretty-json
  title: GitHub Repo Fetch Pretty JSON
spec:
  owner: user:default/c-nell
  type: service

  parameters:
    - title: GitHub Repository
      required:
        - repoName
        - owner
      properties:
        owner:
          title: Repository Owner
          type: string
        repoName:
          title: Repository Name
          type: string

  steps:
    - id: fetchRepo
      name: Fetch GitHub Repository
      action: http:backstage:request
      input:
        method: GET
        path: /proxy/github/repos/${{ parameters.owner }}/${{ parameters.repoName }}
        headers:
          Accept: application/vnd.github.v3+json

    - id: prettyOutput
      name: Pretty JSON Output
      action: http-pretty-output
      input:
        stepName: fetchRepo

    - id: debugOutput
      name: Debug Output
      action: debug:log
      input:
        message: ${{ steps.prettyOutput.output.prettyJson }}
