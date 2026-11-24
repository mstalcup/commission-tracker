import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigw from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as ssm from 'aws-cdk-lib/aws-ssm';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const GOOGLE_PARAM_ID = '/commission-tracker/google-client-id';
export const GOOGLE_PARAM_SECRET = '/commission-tracker/google-client-secret';

/**
 * API routes, grouped by the Lambda that serves them
 * (services/api/src/handlers/<name>.ts). API Gateway does the routing and
 * checks the Cognito login token before any Lambda runs.
 */
const ROUTES: Record<string, string[]> = {
  business: ['GET /api/me', 'PATCH /api/business'],
  clients: [
    'GET /api/clients',
    'POST /api/clients',
    'GET /api/clients/{id}',
    'PATCH /api/clients/{id}',
    'DELETE /api/clients/{id}',
  ],
  commissions: [
    'GET /api/commissions',
    'POST /api/commissions',
    'GET /api/commissions/{id}',
    'PATCH /api/commissions/{id}',
    'DELETE /api/commissions/{id}',
  ],
  payments: ['GET /api/payments', 'POST /api/payments', 'DELETE /api/payments/{id}'],
  expenses: ['GET /api/expenses', 'POST /api/expenses', 'DELETE /api/expenses/{id}'],
  dashboard: ['GET /api/dashboard'],
  uploads: ['POST /api/uploads', 'GET /api/uploads/url'],
};

export interface CommissionTrackerProps extends cdk.StackProps {
  googleEnabled: boolean;
}

export class CommissionTrackerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CommissionTrackerProps) {
    super(scope, id, props);

    // ---------------------------------------------------------------- Data
    const table = (name: string, pk: string, sk?: string) =>
      new dynamodb.TableV2(this, name, {
        partitionKey: { name: pk, type: dynamodb.AttributeType.STRING },
        sortKey: sk ? { name: sk, type: dynamodb.AttributeType.STRING } : undefined,
        billing: dynamodb.Billing.onDemand(),
        pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
        removalPolicy: cdk.RemovalPolicy.RETAIN,
      });
    const gsi = (t: dynamodb.TableV2, indexName: string, pk: string, sk?: string) =>
      t.addGlobalSecondaryIndex({
        indexName,
        partitionKey: { name: pk, type: dynamodb.AttributeType.STRING },
        sortKey: sk ? { name: sk, type: dynamodb.AttributeType.STRING } : undefined,
      });

    const businesses = table('Businesses', 'businessId');
    gsi(businesses, 'bySlug', 'slug');
    const users = table('Users', 'userId');
    gsi(users, 'byBusiness', 'businessId');
    const clients = table('Clients', 'businessId', 'clientId');
    const commissions = table('Commissions', 'businessId', 'commissionId');
    gsi(commissions, 'byStage', 'businessId', 'stageSort');
    gsi(commissions, 'byDueDate', 'businessId', 'dueDate');
    const payments = table('Payments', 'businessId', 'sk');
    gsi(payments, 'byCommission', 'commissionId', 'sk');
    const expenses = table('Expenses', 'businessId', 'sk');
    gsi(expenses, 'byCommission', 'commissionId', 'sk');
    const activity = table('Activity', 'commissionId', 'ts');
    const allTables = [businesses, users, clients, commissions, payments, expenses, activity];

    const uploads = new s3.Bucket(this, 'Uploads', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ---------------------------------------------------------------- Web hosting
    const site = new s3.Bucket(this, 'Site', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Single-page app: any path without a file extension serves index.html,
    // so deep links like /commissions/123 work on refresh.
    const spaRewrite = new cloudfront.Function(this, 'SpaRewrite', {
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(
        `function handler(event) {
  var r = event.request;
  if (!r.uri.includes('.')) r.uri = '/index.html';
  return r;
}`,
      ),
    });

    const api = new apigw.HttpApi(this, 'Api', { createDefaultStage: true });

    const distribution = new cloudfront.Distribution(this, 'Cdn', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(site),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        functionAssociations: [{ function: spaRewrite, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }],
      },
      // The API is served from the same domain under /api, so the browser
      // never needs CORS and the web app needs no API URL config.
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.HttpOrigin(`${api.apiId}.execute-api.${this.region}.amazonaws.com`),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
    });
    const siteUrl = `https://${distribution.distributionDomainName}`;
    const devUrl = 'http://localhost:5173';

    uploads.addCorsRule({
      allowedMethods: [s3.HttpMethods.POST, s3.HttpMethods.GET],
      allowedOrigins: [siteUrl, devUrl],
      allowedHeaders: ['*'],
      maxAge: 3600,
    });

    // ---------------------------------------------------------------- Auth
    const userPool = new cognito.UserPool(this, 'UserPool', {
      selfSignUpEnabled: false, // accounts are created through Google sign-in only
      signInAliases: { email: true },
      accountRecovery: cognito.AccountRecovery.NONE,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const domainPrefix = `commission-tracker-${this.account}`;
    const domain = userPool.addDomain('Domain', { cognitoDomain: { domainPrefix } });
    const cognitoDomain = `${domainPrefix}.auth.${this.region}.amazoncognito.com`;

    const providers: cognito.UserPoolClientIdentityProvider[] = [];
    let googleIdp: cognito.UserPoolIdentityProviderGoogle | undefined;
    if (props.googleEnabled) {
      googleIdp = new cognito.UserPoolIdentityProviderGoogle(this, 'Google', {
        userPool,
        clientId: ssm.StringParameter.valueForStringParameter(this, GOOGLE_PARAM_ID),
        clientSecretValue: cdk.SecretValue.unsafePlainText(
          // Resolved by CloudFormation at deploy time; never written into the template.
          ssm.StringParameter.valueForStringParameter(this, GOOGLE_PARAM_SECRET),
        ),
        scopes: ['openid', 'email', 'profile'],
        attributeMapping: {
          email: cognito.ProviderAttribute.GOOGLE_EMAIL,
          emailVerified: cognito.ProviderAttribute.other('email_verified'),
          fullname: cognito.ProviderAttribute.GOOGLE_NAME,
          profilePicture: cognito.ProviderAttribute.GOOGLE_PICTURE,
        },
      });
      providers.push(cognito.UserPoolClientIdentityProvider.GOOGLE);
    } else {
      providers.push(cognito.UserPoolClientIdentityProvider.COGNITO);
    }

    const webClient = userPool.addClient('WebClient', {
      generateSecret: false,
      supportedIdentityProviders: providers,
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: [`${siteUrl}/callback`, `${devUrl}/callback`],
        logoutUrls: [`${siteUrl}/`, `${devUrl}/`],
      },
      idTokenValidity: cdk.Duration.hours(1),
      accessTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      preventUserExistenceErrors: true,
    });
    if (googleIdp) webClient.node.addDependency(googleIdp);

    const authorizer = new HttpUserPoolAuthorizer('CognitoAuth', userPool, {
      userPoolClients: [webClient],
    });

    // ---------------------------------------------------------------- API Lambdas
    const environment: Record<string, string> = {
      TABLE_BUSINESSES: businesses.tableName,
      TABLE_USERS: users.tableName,
      TABLE_CLIENTS: clients.tableName,
      TABLE_COMMISSIONS: commissions.tableName,
      TABLE_PAYMENTS: payments.tableName,
      TABLE_EXPENSES: expenses.tableName,
      TABLE_ACTIVITY: activity.tableName,
      UPLOADS_BUCKET: uploads.bucketName,
    };

    for (const [name, routeKeys] of Object.entries(ROUTES)) {
      const fn = new NodejsFunction(this, `${name}-fn`, {
        entry: path.join(ROOT, 'services/api/src/handlers', `${name}.ts`),
        projectRoot: ROOT,
        depsLockFilePath: path.join(ROOT, 'package-lock.json'),
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 512,
        timeout: cdk.Duration.seconds(10),
        environment,
        bundling: {
          format: OutputFormat.ESM,
          target: 'node22',
          minify: true,
          sourceMap: true,
          mainFields: ['module', 'main'],
          // Bundle the AWS SDK too: the presigner packages aren't in the Lambda runtime,
          // and bundling pins the exact versions we tested with.
          externalModules: [],
          // Some CJS deps call require(); give ESM bundles a working require.
          banner: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
        },
        logGroup: new logs.LogGroup(this, `${name}-logs`, {
          retention: logs.RetentionDays.ONE_MONTH,
          removalPolicy: cdk.RemovalPolicy.DESTROY,
        }),
      });
      fn.addEnvironment('NODE_OPTIONS', '--enable-source-maps');
      allTables.forEach((t) => t.grantReadWriteData(fn));
      uploads.grantReadWrite(fn);
      uploads.grantDelete(fn);

      const integration = new HttpLambdaIntegration(`${name}-int`, fn);
      for (const key of routeKeys) {
        const [method, routePath] = key.split(' ');
        api.addRoutes({
          path: routePath,
          methods: [method as apigw.HttpMethod],
          integration,
          authorizer,
        });
      }
    }

    // ---------------------------------------------------------------- Deploy the web app
    const webConfig = {
      region: this.region,
      userPoolId: userPool.userPoolId,
      clientId: webClient.userPoolClientId,
      cognitoDomain,
      googleEnabled: props.googleEnabled,
    };
    new s3deploy.BucketDeployment(this, 'DeployWeb', {
      sources: [
        s3deploy.Source.asset(path.join(ROOT, 'apps/web/dist')),
        s3deploy.Source.jsonData('config.json', webConfig),
      ],
      destinationBucket: site,
      distribution,
      distributionPaths: ['/*'],
      memoryLimit: 512,
    });

    // ---------------------------------------------------------------- Outputs
    new cdk.CfnOutput(this, 'SiteUrl', { value: siteUrl });
    new cdk.CfnOutput(this, 'GoogleRedirectUri', {
      value: `https://${cognitoDomain}/oauth2/idpresponse`,
      description: 'Paste into Google Cloud Console > OAuth client > Authorized redirect URIs',
    });
    new cdk.CfnOutput(this, 'CognitoDomain', { value: cognitoDomain });
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'WebClientId', { value: webClient.userPoolClientId });
  }
}
