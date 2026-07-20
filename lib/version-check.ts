// Whether the running page is now behind the deployed one.
//
// The owner kept filling forms on a tab opened before a fix shipped — an old
// bundle, so the fix simply was not there. This is the one decision behind the
// "new version ready" prompt, kept pure so it can be tested and so it can never
// misfire into a reload loop.
//
// `loaded` is the deployment that served this page; `current` is what the server
// reports now. A prompt is offered only when both are known and they differ —
// an empty or unknown value (local dev, an offline blip, system env vars off)
// yields nothing rather than a spurious reload.
export function shouldOfferReload(loaded: unknown, current: unknown): boolean {
  if (typeof loaded !== "string" || typeof current !== "string") {
    return false;
  }

  if (!loaded || !current) {
    return false;
  }

  return loaded !== current;
}
