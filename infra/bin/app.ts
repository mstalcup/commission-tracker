import * as cdk from 'aws-cdk-lib';
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import { AWS_ACCOUNT, AWS_PROFILE, AWS_REGION } from '../config';
import { CommissionTrackerStack, GOOGLE_PARAM_ID, GOOGLE_PARAM_SECRET } from '../lib/stack';

/**
 * Google login is only switched on once its client id/secret exist in SSM
 * Parameter Store (see docs/setup.md). Until then the stack still deploys,
 * so the first deploy can happen before Google is configured.
 */
async function googleConfigured(): Promise<boolean> {
  const ssm = new SSMClient({ region: AWS_REGION, profile: process.env.AWS_PROFILE ?? AWS_PROFILE });
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
  env: { account: AWS_ACCOUNT, region: AWS_REGION },
  googleEnabled: google,
});
