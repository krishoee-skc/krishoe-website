/**
 * Bringing a factory worker into the app (owner, 2026-10-02: "how do I open my
 * worker's account — by mobile or by Gmail?").
 *
 * A worker has a phone, and rarely an inbox they use. So the account is made
 * from the worker's own row with the mobile number alone, and the first
 * password is a code the app makes — eight digits — sent to the worker on
 * WhatsApp with the link, instead of a password the owner invents and says out
 * loud. The code only opens the door once: the first sign-in asks the worker
 * for a password of their own.
 *
 * That password may be eight characters for a worker. Twelve was the bar for
 * everyone, and it is the step a worker on the shop floor stops at, writes on
 * the wall, or forgets by next week. Six wrong tries still lock the account for
 * fifteen minutes (lib/login-rate-limit.ts), and a worker sees only their own
 * pairs and pay.
 */

/** Characters a worker's own password needs. Twelve stays for everyone else. */
export const WORKER_PASSWORD_MIN = 8;

/** Eight random digits, from the platform's secure random source. */
export function generateJoinCode() {
  const buffer = new Uint32Array(8);
  globalThis.crypto.getRandomValues(buffer);
  return Array.from(buffer, (value) => String(value % 10)).join("");
}

/** "4827 1593", easier to read off a screen and type. */
export function spacedCode(code: string) {
  return code.length === 8 ? `${code.slice(0, 4)} ${code.slice(4)}` : code;
}

/**
 * Why a worker's own new password is refused, or "" if it will do — in both
 * languages, because the worker reads it on the change-password screen.
 */
export function workerPasswordProblem(password: string, phone = "") {
  if (password.length < WORKER_PASSWORD_MIN) {
    return `Use at least ${WORKER_PASSWORD_MIN} characters. · कम्तीमा ${WORKER_PASSWORD_MIN} अक्षर चाहिन्छ।`;
  }
  if (/(.)\1{5,}/.test(password)) return "Choose a less repetitive password. · एउटै अक्षर धेरै पटक नदोहोर्याउनुहोस्।";
  if (/^(?:0?12345678|123456789|87654321|password|krishoe|qwerty)/i.test(password)) {
    return "That one is too easy to guess. · यो अरूले सजिलै अनुमान गर्छन्।";
  }
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 8 && password.replace(/\D/g, "").includes(digits.slice(-8))) {
    return "Do not use your own mobile number. · आफ्नै मोबाइल नम्बर नराख्नुहोस्।";
  }
  return "";
}

/** The message the worker gets on WhatsApp: the link, the number to sign in with, the code. */
export function joinMessage(input: { name: string; phone: string; code: string; loginUrl: string }) {
  return [
    `नमस्ते ${input.name} 🙏 KRISHOE app मा तपाईंको खाता खुल्यो।`,
    `१) यो लिंक खोल्नुहोस्: ${input.loginUrl}`,
    `२) मोबाइल नम्बर: ${input.phone}`,
    `३) सुरुको कोड: ${spacedCode(input.code)} (ठाउँ नराखी लेख्नुहोस्)`,
    `भित्र गएपछि आफ्नै ${WORKER_PASSWORD_MIN} अक्षरको password बनाउनुहोस्। यो कोड अरू कसैलाई नदिनुहोस्।`,
  ].join("\n");
}

/** wa.me wants the number with Nepal's 977 and nothing else. */
export function whatsappNumberFor(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("977")) return digits;
  return digits.length === 10 ? `977${digits}` : digits;
}
