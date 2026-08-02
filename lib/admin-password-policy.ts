export function adminPasswordPolicyMessage(password: string) {
  if (password.length < 12) return "Password must be at least 12 characters.";
  if (!/[A-Za-z]/.test(password)) return "Password must include at least one letter.";
  if (!/\d/.test(password)) return "Password must include at least one number.";
  if (/(.)\1{5,}/i.test(password)) return "Choose a less repetitive password.";
  if (/password|123456|qwerty|krishoe123/i.test(password)) {
    return "Choose a password that is harder to guess.";
  }
  return "";
}

export function adminPasswordStrength(password: string) {
  if (!password) return { score: 0, label: "Not entered" };
  let score = 0;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) return { score, label: "Weak" };
  if (score <= 3) return { score, label: "Good" };
  return { score, label: "Strong" };
}
