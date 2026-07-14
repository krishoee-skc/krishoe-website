export type CustomerProfileInput = {
  name: string;
  phone?: string;
  address?: string;
};

export type NormalizedCustomerProfile = {
  name: string;
  phone?: string;
  address?: string;
};

type CustomerProfileRules = {
  requirePhone?: boolean;
  requireAddress?: boolean;
};

type CustomerProfileResult =
  | {
      ok: true;
      profile: NormalizedCustomerProfile;
    }
  | {
      ok: false;
      message: string;
    };

function cleanOptionalText(value?: string) {
  const trimmed = value?.trim() ?? "";
  return trimmed || undefined;
}

export function normalizeCustomerPhone(value?: string) {
  const compact = (value ?? "").replace(/[\s().-]/g, "");

  if (!compact) {
    return "";
  }

  if (!/^\+?\d{7,15}$/.test(compact)) {
    return null;
  }

  return compact;
}

export function validateCustomerProfileInput(
  input: CustomerProfileInput,
  rules: CustomerProfileRules = {},
): CustomerProfileResult {
  const name = input.name.trim();
  const phone = normalizeCustomerPhone(input.phone);
  const address = cleanOptionalText(input.address);

  if (!name) {
    return { ok: false, message: "Full name is required." };
  }

  if (name.length > 80) {
    return { ok: false, message: "Full name is too long." };
  }

  if (phone === null) {
    return { ok: false, message: "Please enter a valid phone number." };
  }

  if (rules.requirePhone && !phone) {
    return { ok: false, message: "Phone number is required." };
  }

  if (rules.requireAddress && !address) {
    return { ok: false, message: "Delivery address is required." };
  }

  if (address && address.length > 600) {
    return { ok: false, message: "Delivery address is too long." };
  }

  return {
    ok: true,
    profile: {
      name,
      phone: phone || undefined,
      address,
    },
  };
}
