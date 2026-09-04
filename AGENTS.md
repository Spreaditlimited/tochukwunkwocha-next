# Repository implementation rules

## Static-site parity

When a request says that behavior must match `/Users/tochukwunkwocha/projects/tochukwunkwocha-site`, inspect the corresponding static-site implementation and reproduce its user flow one-to-one. Do not substitute an approximate flow or move an embedded dashboard workflow to a public page. Any intentional deviation requires the user's explicit approval.

## Deployment authorization

Never deploy or push changes unless the user explicitly instructs Codex to deploy. A request to investigate, fix, implement, test, commit, or otherwise change the application does not authorize a deployment or push. Leave completed changes local until the user gives an express deployment instruction.
