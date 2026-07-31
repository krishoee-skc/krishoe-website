import { describe, expect, it } from "vitest";
import { currentDeploymentVersion } from "@/lib/deployment-version";

describe("the current deployment version", () => {
  it("prefers the git commit sha when Vercel provides one", () => {
    expect(currentDeploymentVersion({ VERCEL_GIT_COMMIT_SHA: "commit-sha", VERCEL_URL: "deploy-url" })).toBe(
      "commit-sha",
    );
  });

  it("falls back to a unique deployment URL for CLI deployments", () => {
    expect(currentDeploymentVersion({ VERCEL_URL: "krishoe-abc.vercel.app" })).toBe("krishoe-abc.vercel.app");
  });

  it("stays empty in local dev when no deployment marker exists", () => {
    expect(currentDeploymentVersion({})).toBe("");
  });
});
