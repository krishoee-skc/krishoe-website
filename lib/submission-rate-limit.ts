import { checkAndRecordRateLimit } from "@/lib/rate-limit-store";

type SubmissionLimitOptions = {
  bucket: string;
  key: string;
  maxAttempts: number;
  windowMs: number;
};

export async function checkAndRecordSubmissionLimit({
  bucket,
  key,
  maxAttempts,
  windowMs,
}: SubmissionLimitOptions) {
  return checkAndRecordRateLimit({
    bucket: `submission:${bucket}`,
    key,
    maxAttempts,
    windowMs,
  });
}
