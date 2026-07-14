import { cookies } from "next/headers";
import {
  customerSessionCookieName,
  getCustomerSessionMaxAge,
  verifyCustomerSessionToken,
  type CustomerSessionPayload,
} from "@/lib/customer-session";
import { getSafeUserById } from "@/lib/user-store";

export async function getCustomerSession(): Promise<CustomerSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(customerSessionCookieName)?.value;
  return verifyCustomerSessionToken(token);
}

export async function getCurrentCustomer() {
  const session = await getCustomerSession();
  return session ? getSafeUserById(session.userId) : null;
}

export async function requireCustomerSession() {
  const session = await getCustomerSession();

  if (!session) {
    throw new Error("Unauthorized customer action.");
  }

  return session;
}

export async function setCustomerSessionCookie(token: string) {
  const cookieStore = await cookies();

  cookieStore.set({
    name: customerSessionCookieName,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getCustomerSessionMaxAge(),
  });
}

export async function clearCustomerSessionCookie() {
  const cookieStore = await cookies();

  cookieStore.set({
    name: customerSessionCookieName,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
