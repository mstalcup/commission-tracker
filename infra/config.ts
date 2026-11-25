/**
 * Where the app is deployed. Pinned on purpose: CDK refuses to deploy if the
 * credentials belong to a different account, so a stray `default` profile
 * can't send the app to the wrong place.
 */
export const AWS_PROFILE = 'mastalcup';
export const AWS_ACCOUNT = '629115319102';
export const AWS_REGION = 'us-west-2';
