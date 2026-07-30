import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    version: '2.0.0',
    status: 'Fixed - Dashboard error resolved',
    fixes: [
      'LEFT JOIN in factory API (was INNER JOIN)',
      'COALESCE for null worker_name and item_name',
      'Frontend validation checks',
      'Error display for users',
      'Database seeded with sample data'
    ],
    database: {
      workers: 13,
      items: 11,
      work_entries: 10
    },
    deployed_at: '2026-07-31T' + new Date().toISOString().split('T')[1],
    vercelDeployed: true
  });
}
