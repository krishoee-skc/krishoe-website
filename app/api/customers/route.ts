import { authorizeFactoryApi } from "@/lib/factory-api-access";
import { createCustomer, getCustomer } from "@/lib/customer-engagement-gateway";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const denied = await authorizeFactoryApi("/api/customers", "POST");
  if (denied) return denied;

  try {
    const body = await request.json();

    const customer = await createCustomer({
      name: typeof body.name === "string" ? body.name.trim() : "",
      email: body.email ? String(body.email).trim() : undefined,
      phone: body.phone ? String(body.phone).trim() : undefined,
      whatsapp_number: body.whatsapp_number ? String(body.whatsapp_number).trim() : undefined,
      city: body.city ? String(body.city).trim() : undefined,
      country: body.country || "Nepal",
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error("Error creating customer:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create customer" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const denied = await authorizeFactoryApi("/api/customers", "GET");
  if (denied) return denied;

  try {
    const customerId = request.nextUrl.searchParams.get("id");

    if (!customerId) {
      return NextResponse.json(
        { error: "Customer ID is required" },
        { status: 400 }
      );
    }

    const customer = await getCustomer(customerId);

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ customer });
  } catch (error) {
    console.error("Error fetching customer:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer" },
      { status: 500 }
    );
  }
}
