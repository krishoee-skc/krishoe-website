/**
 * Tells the owner the shop stopped answering — from outside the shop.
 *
 * This is deliberately not a notification the app sends. The app cannot send
 * it: the probe files its reading through /api/monitoring/uptime, and during a
 * real outage that endpoint is down with everything else. The probe retries for
 * about three minutes and then gives up, so an outage longer than three minutes
 * — which is every outage that actually costs the shop a customer — would leave
 * no row to notify from. The longest failures would be the silent ones.
 *
 * So the alert is sent from GitHub's machines, in the same job that noticed.
 * Nothing here touches the database or the app.
 *
 * Two channels, each independent:
 *
 *   Email     EMAIL_PROVIDER_URL + EMAIL_PROVIDER_TOKEN + ALERT_EMAIL_TO
 *             Brevo's shape when the URL points at Brevo, the generic JSON
 *             contract otherwise — the same two shapes lib/notifications.ts
 *             already speaks, so one provider serves both.
 *
 *   WhatsApp  TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN
 *             + TWILIO_WHATSAPP_NUMBER (from) + WHATSAPP_ADMIN_NUMBER (to)
 *
 * A channel with no secrets is skipped, not failed: the shop can start with
 * email today and add WhatsApp when the Twilio account exists. Neither channel
 * can throw — an alert that crashes the job would also lose the reading the job
 * was there to file.
 */

/**
 * A secret as a person actually pastes it.
 *
 * These values are copied out of .env.local, where every one of them is
 * written EMAIL_PROVIDER_URL="https://…" — so the quotes come along, and
 * sometimes the name and the equals sign as well. GitHub stores whatever it is
 * given and masks it in the logs, so the mistake is invisible from both ends:
 * the first sign of it here was fetch reporting `Failed to parse URL from ***`,
 * which names neither the setting nor the problem.
 *
 * A .env file's own quoting is not part of the value, so it is taken off. This
 * cannot corrupt a correct secret — no URL, API key, email address or phone
 * number legitimately begins and ends with the same quote mark.
 */
const env = (key) => {
  const raw = (process.env[key] || "").trim();
  const withoutName = raw.startsWith(`${key}=`) ? raw.slice(key.length + 1).trim() : raw;

  return withoutName.length >= 2 &&
    (withoutName.startsWith('"') || withoutName.startsWith("'")) &&
    withoutName.at(-1) === withoutName[0]
    ? withoutName.slice(1, -1).trim()
    : withoutName;
};

/** Long enough for a slow provider, short enough not to hold the job open. */
const TIMEOUT_MS = 15_000;

async function postWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * What the owner reads on a phone, at whatever hour this fires.
 *
 * The shop's address first, because the owner runs one shop and reads this half
 * asleep; then what to do, because "KRISHOE is down" with no next step is just
 * worry. Nepali and English together — the same rule the screens follow.
 *
 * @param {{
 *   state: "down" | "up",
 *   url: string,
 *   statusCode?: number,
 *   error?: string,
 *   downSince?: string | null,
 * }} details
 */
export function alertMessage({ state, url, statusCode, error, downSince }) {
  const when = new Date().toLocaleString("en-GB", {
    timeZone: "Asia/Kathmandu",
    dateStyle: "medium",
    timeStyle: "short",
  });

  if (state === "down") {
    const cause = statusCode ? `HTTP ${statusCode}` : error || "no answer";
    return {
      subject: "KRISHOE is down / पसल खुलेन",
      body: [
        `KRISHOE बन्द छ — ग्राहकले पसल खोल्न सक्दैनन्।`,
        `KRISHOE is not answering. Customers cannot open the shop.`,
        ``,
        `कहिले / When:  ${when} (Kathmandu)`,
        `के भयो / What: ${cause}`,
        `ठेगाना / Address: ${url}`,
        ``,
        `के गर्ने / What to do:`,
        `1. आफैं खोलेर हेर्नुहोस् — ${url}`,
        `2. खुल्यो भने केही गर्नु पर्दैन, आफैं ठीक भयो।`,
        `3. नखुले Vercel मा गएर पछिल्लो deploy हेर्नुहोस्:`,
        `   https://vercel.com/dashboard`,
        ``,
        `यो सन्देश GitHub बाट आएको हो, app बाट होइन — त्यसैले app बन्द हुँदा पनि आउँछ.`,
      ].join("\n"),
    };
  }

  const forHowLong = downSince
    ? `${Math.max(1, Math.round((Date.now() - Date.parse(downSince)) / 60_000))} मिनेट / minutes`
    : "";

  return {
    subject: "KRISHOE is back / पसल फेरि खुल्यो",
    body: [
      `KRISHOE फेरि चल्यो। ग्राहकले पसल खोल्न सक्छन्।`,
      `KRISHOE is answering again. The shop is open to customers.`,
      ``,
      `कहिले / When: ${when} (Kathmandu)`,
      forHowLong ? `कति बेर बन्द थियो / Was down for: ${forHowLong}` : ``,
      `ठेगाना / Address: ${url}`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

/**
 * Email, through whichever provider the shop already pays for.
 *
 * Brevo is detected by URL exactly as lib/notifications.ts detects it, so the
 * one EMAIL_PROVIDER_URL the shop has configured works here without a second
 * account or a second shape to keep in step.
 */
async function sendEmail({ subject, body }) {
  const url = env("EMAIL_PROVIDER_URL");
  const to = env("ALERT_EMAIL_TO") || env("ADMIN_NOTIFICATION_EMAIL");
  const token = env("EMAIL_PROVIDER_TOKEN");
  // Brevo authenticates with the api-key header and refuses without it, so an
  // absent token there is a missing setting, not a send that happened to fail.
  // Left unchecked, it reached the owner as a bare "HTTP 401" — a number that
  // does not name the field to go and fill in. The generic contract may
  // legitimately have no token, so the requirement follows the provider.
  const tokenRequired = url.includes("api.brevo.com");

  // Checked here rather than left to fetch, which reports `Failed to parse URL
  // from ***` — the value masked, the setting unnamed, and nothing to act on.
  if (url && !URL.canParse(url)) {
    return {
      channel: "email",
      sent: false,
      reason:
        "EMAIL_PROVIDER_URL is not a web address. A value copied out of .env.local usually still has its quotes around it — paste just the https://… part.",
    };
  }

  if (!url || !to || (tokenRequired && !token)) {
    return {
      channel: "email",
      sent: false,
      reason: "not configured",
      // Which ones, by name. "Not configured" on its own sends the reader back
      // to a settings page with eight fields and no idea which is wrong — the
      // same shape as an outage alert that says only "KRISHOE is down".
      missing: [
        !url && "EMAIL_PROVIDER_URL",
        tokenRequired && !token && "EMAIL_PROVIDER_TOKEN",
        !to && "ALERT_EMAIL_TO",
      ].filter(Boolean),
    };
  }

  const headers = { "Content-Type": "application/json" };
  let payload;

  if (url.includes("api.brevo.com")) {
    if (token) headers["api-key"] = token;
    payload = {
      sender: { name: "KRISHOE", email: env("EMAIL_SENDER_ADDRESS") || to },
      to: [{ email: to }],
      subject,
      // Plain text only. This is read on a phone at three in the morning, and
      // a branded HTML frame with a remote logo Gmail will not load adds
      // nothing to a sentence that has to be understood immediately.
      textContent: body,
    };
  } else {
    if (token) headers.Authorization = `Bearer ${token}`;
    payload = { source: "krishoe", channel: "email-http", to, subject, message: body };
  }

  try {
    const response = await postWithTimeout(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    return response.ok
      ? { channel: "email", sent: true }
      : { channel: "email", sent: false, reason: `HTTP ${response.status}` };
  } catch (error) {
    return { channel: "email", sent: false, reason: error.message };
  }
}

/**
 * WhatsApp, through Twilio's REST API directly.
 *
 * The twilio npm package is not used: this job installs nothing on purpose, so
 * that a check running every twenty minutes does not spend its life installing
 * packages, and so nothing third-party runs next to these secrets.
 */
async function sendWhatsApp({ subject, body }) {
  const sid = env("TWILIO_ACCOUNT_SID");
  const token = env("TWILIO_AUTH_TOKEN");
  const from = env("TWILIO_WHATSAPP_NUMBER");
  const to = env("WHATSAPP_ADMIN_NUMBER");
  if (!sid || !token || !from || !to) {
    return {
      channel: "whatsapp",
      sent: false,
      reason: "not configured",
      missing: [
        !sid && "TWILIO_ACCOUNT_SID",
        !token && "TWILIO_AUTH_TOKEN",
        !from && "TWILIO_WHATSAPP_NUMBER",
        !to && "WHATSAPP_ADMIN_NUMBER",
      ].filter(Boolean),
    };
  }

  const whatsappNumber = (value) =>
    value.startsWith("whatsapp:") ? value : `whatsapp:${value.startsWith("+") ? value : `+${value}`}`;

  try {
    const response = await postWithTimeout(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: whatsappNumber(from),
          To: whatsappNumber(to),
          Body: `${subject}\n\n${body}`,
        }).toString(),
      },
    );
    return response.ok
      ? { channel: "whatsapp", sent: true }
      : { channel: "whatsapp", sent: false, reason: `HTTP ${response.status}` };
  } catch (error) {
    return { channel: "whatsapp", sent: false, reason: error.message };
  }
}

/**
 * Send on every channel that is configured, and say what happened.
 *
 * Both are attempted even if the first fails — the point of two channels is
 * that one of them arrives.
 *
 * @param {Parameters<typeof alertMessage>[0]} details
 */
export async function sendUptimeAlert(details) {
  const message = alertMessage(details);
  const results = await Promise.all([sendEmail(message), sendWhatsApp(message)]);

  for (const result of results) {
    if (result.sent) {
      console.log(`[uptime] alert sent by ${result.channel}`);
    } else if (result.reason === "not configured") {
      // Names only. A log that echoed a value back would put the shop's email
      // key into a build log anyone with read access can open, which is a
      // worse problem than the one being diagnosed.
      console.log(
        `[uptime] ${result.channel} alert skipped — empty here: ${result.missing.join(", ")}`,
      );
    } else {
      console.error(`[uptime] ${result.channel} alert failed — ${result.reason}`);
    }
  }

  return results;
}
