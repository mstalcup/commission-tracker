# Setup & deploy

Everything deploys to a single AWS environment (prod) with one command.

## Prerequisites
- Node.js 22+ and npm
- AWS CLI v2 with credentials for the target account (`aws configure`). The default region is `us-east-1`.
- A Google account, used to create the OAuth client

## 1. Install and bootstrap (one time)
```sh
npm install
npx -w @ct/infra cdk bootstrap        # once per AWS account/region
```

## 2. First deploy
```sh
npm run deploy
```
This builds the web app and runs `cdk deploy`. The stack outputs are written to `cdk-outputs.json`:
- `SiteUrl`: the app, e.g. `https://dxxxxxxxx.cloudfront.net`
- `GoogleRedirectUri`: needed in the next step. It is always `https://commission-tracker-<AWS account id>.auth.us-east-1.amazoncognito.com/oauth2/idpresponse`.

Until Google is configured, the app loads but sign-in is disabled.

## 3. Create the Google OAuth client (one time)
1. Go to <https://console.cloud.google.com/>, then create or select a project.
2. Open **APIs & Services → OAuth consent screen**:
   - Choose **External**.
   - Fill in the app name, support email and developer email.
   - Scopes: `openid`, `email`, `profile` (the defaults, so you don't need to add anything).
   - While the app is in **Testing** mode, add your own Google address under *Test users*. Click **Publish app** when you want anyone to be able to sign in. These basic scopes don't need Google verification.
3. Open **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized JavaScript origins: `https://commission-tracker-<account id>.auth.us-east-1.amazoncognito.com`
   - Authorized redirect URIs: the `GoogleRedirectUri` output from step 2
4. Copy the client ID and client secret into SSM Parameter Store. Use PowerShell or cmd; in Git Bash, prefix the commands with `MSYS_NO_PATHCONV=1`.
   ```sh
   aws ssm put-parameter --name /commission-tracker/google-client-id --type String --value "<client id>"
   aws ssm put-parameter --name /commission-tracker/google-client-secret --type String --value "<client secret>"
   ```
   CloudFormation reads these at deploy time, so the values never appear in the repo or in the template.

## 4. Deploy again
```sh
npm run deploy
```
When `bin/app.ts` finds the SSM parameters, it switches on the Google login. Open `SiteUrl` and click **Sign in with Google**.

## Local development
```sh
npm run dev
```
This runs the web app at <http://localhost:5173>. It uses the **deployed** backend, proxying `/api` and `/config.json` to the `SiteUrl` in `cdk-outputs.json`. Sign-in works locally because `http://localhost:5173/callback` is an allowed callback URL.

## Useful commands
| Command | What it does |
|---|---|
| `npm run dev` | Web app with hot reload, against the deployed API |
| `npm test` | Unit tests (Vitest) |
| `npm run typecheck` | TypeScript checks for every package |
| `npm run synth` | Build the web app and synthesize the CloudFormation template without deploying |
| `npm run deploy` | Build and deploy everything |

## What gets created
- 7 DynamoDB tables (on-demand billing, point-in-time recovery, retained if the stack is deleted)
- An S3 bucket for uploads (retained) and one for the static site
- A CloudFront distribution: `/` serves the site, and `/api/*` goes to API Gateway
- A Cognito user pool with the Google identity provider
- API Gateway HTTP API with a Cognito JWT authorizer, plus one Lambda per resource

At hobby scale, all of this costs roughly $0–2 per month.
