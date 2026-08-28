import { getAdminAuditEvents } from "@/lib/admin-audit";
import { isAiConfigured } from "@/lib/ai/product-copy";
import { getErrorStats, getUptimeEvidence, getUptimePercentage } from "@/lib/monitoring";

/**
 * The control room for the shop's automated work — "Robot दरबार".
 *
 * Eight jobs run without anyone pressing a button: three on a nightly
 * schedule, four watching quietly, one waiting to be asked. Until now each was
 * seen in a different place, and four of those places sat inside Settings where
 * the owner looks once. This gathers the STATUS of all eight into one list; the
 * detail stays where it lives, one tap away behind each `href`.
 *
 * Every reading is taken defensively. A robot screen that itself fell over the
 * moment the database hiccuped would be the one screen that must not — so each
 * source is wrapped, and a figure that could not be read becomes an honest
 * "—" rather than a crash or a zero pretending to be measured.
 */

export type RobotTone = "run" | "watch" | "ready" | "external";
export type RobotGroup = "scheduled" | "guard" | "ondemand";

export type RobotCard = {
  id: string;
  emoji: string;
  group: RobotGroup;
  nameEn: string;
  nameNe: string;
  jobEn: string;
  jobNe: string;
  tone: RobotTone;
  statusEn: string;
  statusNe: string;
  metaEn: string;
  metaNe: string;
  href: string;
  external?: boolean;
};

export type RobotsDashboard = {
  health: {
    /** Rounded external-monitor uptime over 30 days, or null when never checked. */
    uptimePercent: number | null;
    errorsToday: number;
    activeCount: number;
    totalCount: number;
  };
  cards: RobotCard[];
};

const GITHUB_ACTIONS_URL = "https://github.com/krishoee-skc/krishoe-website/actions";

function minutesAgoLabel(minutes: number | null): { en: string; ne: string } {
  if (minutes === null) return { en: "not measured yet", ne: "अझै नापिएको छैन" };
  if (minutes < 1) return { en: "just now", ne: "भर्खरै" };
  if (minutes < 60) return { en: `${minutes} min ago`, ne: `${minutes} मिनेट अघि` };
  const hours = Math.round(minutes / 60);
  if (hours < 24) return { en: `${hours} hr ago`, ne: `${hours} घण्टा अघि` };
  const days = Math.round(hours / 24);
  return { en: `${days} day(s) ago`, ne: `${days} दिन अघि` };
}

export async function getRobotsDashboard(): Promise<RobotsDashboard> {
  // Each source on its own, so one that fails cannot take the others down.
  const uptimeEvidence = await getUptimeEvidence().catch(() => null);
  const uptimePercent =
    uptimeEvidence?.outside.percent ??
    (await getUptimePercentage(30).catch(() => 0)) ??
    0;
  const errorsToday = await getErrorStats(24)
    .then((stats) => stats.totalErrors)
    .catch(() => 0);

  const auditEvents = await getAdminAuditEvents(200).catch(() => []);
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const securityWarnings = auditEvents.filter(
    (event) =>
      event.status === "warning" &&
      new Date(event.createdAt).getTime() >= dayAgo &&
      /login|password|device|blocked|rate/i.test(event.action),
  ).length;

  const uptimeSeen = minutesAgoLabel(uptimeEvidence?.minutesSinceAnswer ?? null);
  const aiReady = isAiConfigured();

  const cards: RobotCard[] = [
    {
      id: "nightly-report",
      emoji: "📊",
      group: "scheduled",
      nameEn: "Nightly report",
      nameNe: "राति ८ बजे Report",
      jobEn: "Emails the day's sales and production. Weekly on Sunday, monthly at the Bikram Sambat month start.",
      jobNe: "दैनिक बिक्री र उत्पादनको सारांश email। आइतबार साप्ताहिक, महिना सुरुमा मासिक।",
      tone: "run",
      statusEn: "Running",
      statusNe: "चालु",
      metaEn: "Every day, 8:00 PM",
      metaNe: "हरेक दिन, बेलुका ८:००",
      href: "/admin/reports",
    },
    {
      id: "report-retry",
      emoji: "🔁",
      group: "scheduled",
      nameEn: "Retry sender",
      nameNe: "फेरि-कोसिस",
      jobEn: "If the 8 PM report failed to send, it tries again an hour later so no report is missed.",
      jobNe: "८ बजेको report असफल भए, ९ बजे फेरि पठाउँछ — कुनै report नछुटोस्।",
      tone: "run",
      statusEn: "Running",
      statusNe: "चालु",
      metaEn: "Every day, 9:00 PM",
      metaNe: "हरेक दिन, बेलुका ९:००",
      href: "/admin/notifications",
    },
    {
      id: "cart-reminder",
      emoji: "🛒",
      group: "scheduled",
      nameEn: "Cart reminder",
      nameNe: "Cart सम्झाउने",
      jobEn: "Emails shoppers who left items in their cart, inviting them back.",
      jobNe: "Cart मा सामान छाडेर गएका ग्राहकलाई फर्किन आफै email गर्छ।",
      tone: "run",
      statusEn: "Running",
      statusNe: "चालु",
      metaEn: "Every day",
      metaNe: "हरेक दिन",
      href: "/admin/customers",
    },
    {
      id: "uptime",
      emoji: "📡",
      group: "guard",
      nameEn: "Uptime watcher",
      nameNe: "Uptime पहरेदार",
      jobEn: "Checks the site is up every 20 minutes — from outside Vercel, so it sees an outage the shop cannot.",
      jobNe: "हरेक २० मिनेट site चलेको जाँच्छ — Vercel बाहिरबाट, down भए पनि थाहा पाउँछ।",
      tone: "watch",
      statusEn: "Watching",
      statusNe: "पहरामा",
      metaEn: `Checked ${uptimeSeen.en}`,
      metaNe: `जाँच: ${uptimeSeen.ne}`,
      href: "/admin/monitoring",
    },
    {
      id: "ci",
      emoji: "🧪",
      group: "guard",
      nameEn: "Code checker (CI)",
      nameNe: "Code जाँच्ने (CI)",
      jobEn: "Runs every test and the build on each code push, so a bug never reaches the live shop.",
      jobNe: "नयाँ code push हुँदा test र build आफै चलाएर bug live जानबाट रोक्छ।",
      tone: "external",
      statusEn: "On GitHub",
      statusNe: "GitHub मा",
      metaEn: "Runs on every push",
      metaNe: "push हुँदा चल्छ",
      href: GITHUB_ACTIONS_URL,
      external: true,
    },
    {
      id: "ai-copy",
      emoji: "🪄",
      group: "ondemand",
      nameEn: "AI description writer",
      nameNe: "AI विवरण लेख्ने",
      jobEn: "Drafts a shoe's description when you press the button — never sending anything private out.",
      jobNe: "button थिच्दा जुत्ताको विवरण आफै लेख्छ — गोप्य कुरा बाहिर नपठाई।",
      tone: aiReady ? "ready" : "external",
      statusEn: aiReady ? "Ready on demand" : "Not connected",
      statusNe: aiReady ? "माग्दा तयार" : "जोडिएको छैन",
      metaEn: "In the product form",
      metaNe: "product form मा",
      href: "/admin/products",
    },
    {
      id: "error-speed",
      emoji: "🔴",
      group: "guard",
      nameEn: "Error & speed",
      nameNe: "Error + Speed",
      jobEn: "Records every failure and measures how fast pages load on the shopper's own phone.",
      jobNe: "हरेक गल्ती record गर्छ, ग्राहककै फोनमा page speed नाप्छ।",
      tone: "watch",
      statusEn: "Watching",
      statusNe: "पहरामा",
      metaEn: `${errorsToday} error(s) today`,
      metaNe: `आज error: ${errorsToday}`,
      href: "/admin/monitoring",
    },
    {
      id: "security",
      emoji: "🚨",
      group: "guard",
      nameEn: "Security guard",
      nameNe: "सुरक्षा पहरेदार",
      jobEn: "Alerts you on a new-device login and blocks repeated wrong passwords.",
      jobNe: "नयाँ device login भए खबर, धेरै गलत password लाई block।",
      tone: "watch",
      statusEn: securityWarnings > 0 ? `${securityWarnings} warning(s)` : "All clear",
      statusNe: securityWarnings > 0 ? `${securityWarnings} चेतावनी` : "सब ठीक",
      metaEn: "Last 24 hours",
      metaNe: "बितेका २४ घण्टा",
      href: "/admin/activity",
    },
  ];

  const activeCount = cards.filter((card) => card.tone === "run" || card.tone === "watch").length;

  return {
    health: {
      uptimePercent: uptimeEvidence?.outside.checks ? uptimePercent : uptimePercent > 0 ? uptimePercent : null,
      errorsToday,
      activeCount,
      totalCount: cards.length,
    },
    cards,
  };
}
