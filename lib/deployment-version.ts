type DeploymentEnv = {
  [key: string]: string | undefined;
  VERCEL_GIT_COMMIT_SHA?: string;
  NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?: string;
  VERCEL_DEPLOYMENT_ID?: string;
  VERCEL_URL?: string;
};

export function currentDeploymentVersion(env: DeploymentEnv = process.env): string {
  return (
    env.VERCEL_GIT_COMMIT_SHA ||
    env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    env.VERCEL_DEPLOYMENT_ID ||
    env.VERCEL_URL ||
    ""
  );
}
