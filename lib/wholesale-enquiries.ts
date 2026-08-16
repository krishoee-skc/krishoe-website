import { queryPostgres } from "@/lib/postgres/client";

export type WholesaleEnquiryStatus = "New" | "Contacted" | "Customer" | "Closed";

export type WholesaleEnquiry = {
  id: string;
  createdAt: string;
  shopName: string;
  contactName: string;
  phone: string;
  email: string;
  location: string;
  requirement: string;
  monthlyPairs: number;
  status: WholesaleEnquiryStatus;
  note: string;
};

type EnquiryRow = {
  id: string;
  created_at: Date | string;
  shop_name: string;
  contact_name: string;
  phone: string;
  email: string;
  location: string;
  requirement: string;
  monthly_pairs: number | string;
  status: WholesaleEnquiryStatus;
  note: string;
};

const STORE = "contact messages";
const COLUMNS = `id, created_at, shop_name, contact_name, phone, email, location,
  requirement, monthly_pairs, status, note`;

function enquiryFromRow(row: EnquiryRow): WholesaleEnquiry {
  return {
    id: row.id,
    createdAt: new Date(row.created_at).toISOString(),
    shopName: row.shop_name,
    contactName: row.contact_name,
    phone: row.phone,
    email: row.email ?? "",
    location: row.location ?? "",
    requirement: row.requirement ?? "",
    monthlyPairs: Math.max(0, Math.round(Number(row.monthly_pairs) || 0)),
    status: row.status,
    note: row.note ?? "",
  };
}

export async function saveWholesaleEnquiry(input: {
  shopName: string;
  contactName: string;
  phone: string;
  email: string;
  location: string;
  requirement: string;
  monthlyPairs: number;
}) {
  const id = `KRS-WHL-${Date.now().toString(36).toUpperCase()}`;

  const rows = await queryPostgres<EnquiryRow>(
    STORE,
    `INSERT INTO wholesale_enquiries (
       id, shop_name, contact_name, phone, email, location, requirement, monthly_pairs
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${COLUMNS}`,
    [
      id,
      input.shopName.slice(0, 120),
      input.contactName.slice(0, 120),
      input.phone.slice(0, 40),
      input.email.slice(0, 160),
      input.location.slice(0, 160),
      input.requirement.slice(0, 1200),
      Math.max(0, Math.round(input.monthlyPairs)),
    ],
  );

  return enquiryFromRow(rows[0]);
}

export async function listWholesaleEnquiries() {
  const rows = await queryPostgres<EnquiryRow>(
    STORE,
    `SELECT ${COLUMNS} FROM wholesale_enquiries ORDER BY created_at DESC LIMIT 200`,
  );
  return rows.map(enquiryFromRow);
}

export async function updateWholesaleEnquiryStatus(
  id: string,
  status: WholesaleEnquiryStatus,
  note: string,
) {
  const rows = await queryPostgres<EnquiryRow>(
    STORE,
    `UPDATE wholesale_enquiries
     SET status = $2, note = $3, updated_at = now()
     WHERE id = $1
     RETURNING ${COLUMNS}`,
    [id, status, note.slice(0, 500)],
  );

  return rows[0] ? enquiryFromRow(rows[0]) : null;
}
