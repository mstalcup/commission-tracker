import * as cdk from 'aws-cdk-lib';
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import { CommissionTrackerStack, GOOGLE_PARAM_ID, GOOGLE_PARAM_SECRET } from '../lib/stack';

const region = process.env.CDK_DEFAULT_REGION ?? 'us-east-1';

/**
 * Google login is only switched on once its client id/secret exist in SSM
 * Parameter Store (see docs/setup.md). Until then the stack still deploys,
 * so the first deploy can happen before Google is configured.
 */
async function googleConfigured(): Promise<boolean> {
  const ssm = new SSMClient({ region });
  try {
    await ssm.send(new GetParameterCommand({ Name: GOOGLE_PARAM_ID }));
    await ssm.send(new GetParameterCommand({ Name: GOOGLE_PARAM_SECRET }));
    return true;
  } catch {
    return false;
  }
}

const google = await googleConfigured();
if (!google) {
  console.warn(`\n⚠  Google login not configured yet (${GOOGLE_PARAM_ID} missing). See docs/setup.md.\n`);
}

const app = new cdk.App();
new CommissionTrackerStack(app, 'CommissionTracker', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region },
  googleEnabled: google,
});
