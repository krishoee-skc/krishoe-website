/**
 * "Chrome on Windows PC" from a browser's user-agent string.
 *
 * The staff list showed the raw string — "Mozilla/5.0 (Windows NT 10.0;
 * Win64; x64)…" — which says nothing to the owner reading it.
 */
export function adminDeviceLabel(userAgent: string) {
  const agent = userAgent.toLowerCase();
  const browser = agent.includes("edg/")
    ? "Edge"
    : agent.includes("chrome/") && !agent.includes("crios/")
      ? "Chrome"
      : agent.includes("crios/")
        ? "Chrome iOS"
        : agent.includes("safari/")
          ? "Safari"
          : agent.includes("firefox/")
            ? "Firefox"
            : "Browser";
  const device = agent.includes("iphone")
    ? "iPhone"
    : agent.includes("ipad")
      ? "iPad"
      : agent.includes("android")
        ? "Android"
        : agent.includes("windows")
          ? "Windows PC"
          : agent.includes("mac os") || agent.includes("macintosh")
            ? "Mac"
            : "Device";

  return `${browser} on ${device}`;
}
