// CivicChain — development seed.
//
// Loads DEMO data ONLY (emails on *.civicchain.dev). Every piece of seeded
// data is explicitly marked:
//   - titles/descriptions start with "DEMO"
//   - audit logs and notifications carry metadata { demo: true }
//   - demo verification tokens are NOT created; real magic-link sign-in still
//     mints tokens through the normal Auth.js flow at login time.
//
// Run: npx prisma db seed   (configured in prisma.config.ts)

import 'dotenv/config';
import { PrismaClient as Client } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env first.');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new Client({ adapter });

const DEPARTMENTS = [
  'Roads & Infrastructure Department',
  'Public Lighting Department',
  'Sanitation Department',
  'Water Supply Department',
  'Infrastructure Department',
];

function deptForCategory(category: string): string | null {
  const map: Record<string, string> = {
    POTHOLE: 'Roads & Infrastructure Department',
    DRAINAGE: 'Roads & Infrastructure Department',
    STREETLIGHT: 'Public Lighting Department',
    GARBAGE: 'Sanitation Department',
    WATER: 'Water Supply Department',
    INFRASTRUCTURE: 'Infrastructure Department',
  };
  return map[category] ?? null;
}

async function main() {
  console.log('[seed] Connecting to PostgreSQL…');

  const users = {
    admin: await prisma.user.upsert({
      where: { email: 'admin@civicchain.dev' },
      update: { role: 'ADMIN' },
      create: { email: 'admin@civicchain.dev', name: 'System Admin', role: 'ADMIN', emailVerified: new Date() },
    }),
    authority: await prisma.user.upsert({
      where: { email: 'authority@civicchain.dev' },
      update: { role: 'AUTHORITY' },
      create: { email: 'authority@civicchain.dev', name: 'Navapur Municipal Operator', role: 'AUTHORITY', emailVerified: new Date() },
    }),
    ravi: await prisma.user.upsert({
      where: { email: 'ravi@civicchain.dev' },
      update: {},
      create: { email: 'ravi@civicchain.dev', name: 'Ravi Kumar', role: 'CITIZEN', emailVerified: new Date() },
    }),
    meera: await prisma.user.upsert({
      where: { email: 'meera@civicchain.dev' },
      update: {},
      create: { email: 'meera@civicchain.dev', name: 'Meera Patel', role: 'CITIZEN', emailVerified: new Date() },
    }),
    priya: await prisma.user.upsert({
      where: { email: 'priya@civicchain.dev' },
      update: {},
      create: { email: 'priya@civicchain.dev', name: 'Priya Sharma', role: 'CITIZEN', emailVerified: new Date() },
    }),
  };
  console.log('[seed] Users ready:', Object.keys(users).join(', '));

  // Authorities match the departments used by the rule-based routing mapping.
  const authorities: Record<string, string> = {};
  for (const department of DEPARTMENTS) {
    let authority = await prisma.authority.findFirst({ where: { department } });
    if (!authority) {
      authority = await prisma.authority.create({
        data: {
          name: `Municipal Corporation of Navapur — ${department}`,
          department,
          email: 'authority@civicchain.dev',
          jurisdiction: 'Navapur, Maharashtra',
        },
      });
    }
    authorities[department] = authority.id;
  }
  // Operator account belongs to the Roads & Infrastructure Department.
  await prisma.authority.update({
    where: { id: authorities['Roads & Infrastructure Department'] },
    data: { userId: users.authority.id },
  });
  console.log('[seed] Authorities ready');

  const existing = await prisma.issue.count();
  if (existing === 0) {
    console.log('[seed] Seeding demo issues on an empty database…');
  } else {
    console.log(`[seed] ${existing} issue(s) already exist — skipping demo issues (idempotent).`);
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();

  interface DemoIssue {
    reporter: 'ravi' | 'meera' | 'priya';
    category: 'POTHOLE' | 'DRAINAGE' | 'STREETLIGHT' | 'GARBAGE' | 'INFRASTRUCTURE' | 'WATER';
    status: 'SUBMITTED' | 'UNDER_REVIEW' | 'VERIFIED' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED';
    title: string;
    description: string;
    location: string;
    lat: number;
    lng: number;
    daysAgo: number;
    promise?: { status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'BROKEN'; daysFromNow: number };
    evidenceUrl?: string;
  }

  const demoIssues: DemoIssue[] = [
    {
      reporter: 'ravi', category: 'POTHOLE', status: 'IN_PROGRESS',
      title: 'DEMO: Large pothole near Navapur bus stand',
      description: 'DEMO DATA. A deep pothole almost 2 feet wide has formed on the slip road to Navapur bus stand and is causing repeated tyre damage.',
      location: 'Bus Stand Road, Navapur', lat: 21.1218, lng: 73.7612, daysAgo: 6,
      promise: { status: 'OPEN', daysFromNow: 6 },
      evidenceUrl: 'https://example.com/demo/pothole-bus-stand.jpg',
    },
    {
      reporter: 'meera', category: 'GARBAGE', status: 'IN_PROGRESS',
      title: 'DEMO: Garbage accumulation at Ward 4 market',
      description: 'DEMO DATA. Solid waste has not been collected for over a week near the Ward 4 market stalls, attracting stray animals.',
      location: 'Ward 4 Market, Mumbai', lat: 19.076, lng: 72.8777, daysAgo: 8,
      promise: { status: 'IN_PROGRESS', daysFromNow: 10 },
    },
    {
      reporter: 'priya', category: 'STREETLIGHT', status: 'ASSIGNED',
      title: 'DEMO: Streetlights out on College Road',
      description: 'DEMO DATA. A block of eight streetlights on College Road has been dark for three nights, leaving the stretch unlit after 7pm.',
      location: 'College Road, Mumbai', lat: 19.045, lng: 72.855, daysAgo: 4,
      evidenceUrl: 'https://example.com/demo/college-road-lights.jpg',
    },
    {
      reporter: 'ravi', category: 'DRAINAGE', status: 'IN_PROGRESS',
      title: 'DEMO: Blocked drain overflowing on MG Road',
      description: 'DEMO DATA. The storm drain at the MG Road junction is blocked and sewage is overflowing onto the footpath.',
      location: 'MG Road, Navapur', lat: 21.1289, lng: 73.7588, daysAgo: 20,
      promise: { status: 'BROKEN', daysFromNow: -5 },
    },
    {
      reporter: 'meera', category: 'WATER', status: 'VERIFIED',
      title: 'DEMO: No water supply in Sector 12',
      description: 'DEMO DATA. Sector 12 has had intermittent water supply for two weeks; tanker supply covers only half the sector.',
      location: 'Sector 12, Navapur', lat: 21.115, lng: 73.749, daysAgo: 3,
    },
    {
      reporter: 'ravi', category: 'INFRASTRUCTURE', status: 'RESOLVED',
      title: 'DEMO: Broken footpath near railway station',
      description: 'DEMO DATA. Tiles on the footpath near the station entrance are broken and lifted, a trip hazard for commuters.',
      location: 'Station Road, Mumbai', lat: 19.072, lng: 72.895, daysAgo: 15,
    },
    {
      reporter: 'priya', category: 'POTHOLE', status: 'RESOLVED',
      title: 'DEMO: Pothole cluster on Ring Road',
      description: 'DEMO DATA. A cluster of five potholes on Ring Road near the flyover approach has been patched.',
      location: 'Ring Road, Navapur', lat: 21.1344, lng: 73.7711, daysAgo: 12,
      promise: { status: 'COMPLETED', daysFromNow: -2 },
    },
    {
      reporter: 'ravi', category: 'GARBAGE', status: 'REJECTED',
      title: 'DEMO: Illegal dumping site near river bank',
      description: 'DEMO DATA. Debris is being dumped along the Tapti river bank. Report was rejected after inspection found no municipal dumping.',
      location: 'Tapti River Bank, Navapur', lat: 21.127, lng: 73.765, daysAgo: 9,
    },
  ];

  const statusFlow: Record<string, string[]> = {
    VERIFIED: ['SUBMITTED', 'UNDER_REVIEW'],
    ASSIGNED: ['SUBMITTED', 'UNDER_REVIEW', 'VERIFIED'],
    IN_PROGRESS: ['SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'ASSIGNED'],
    RESOLVED: ['SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS'],
    REJECTED: ['SUBMITTED', 'UNDER_REVIEW'],
  };

  if (existing === 0) {
    await prisma.$transaction(async (tx) => {
      for (const [index, demo] of demoIssues.entries()) {
      const counter = await tx.refCounter.upsert({
        where: { id: 1 },
        update: { value: { increment: 1 } },
        create: { id: 1, value: 1090 },
      });
      const publicId = `CC-${counter.value}`;
      const createdAt = new Date(now - demo.daysAgo * dayMs);
      const authority = deptForCategory(demo.category);

      const issue = await tx.issue.create({
        data: {
          publicId,
          title: demo.title,
          description: demo.description,
          category: demo.category,
          status: demo.status,
          location: demo.location,
          latitude: demo.lat,
          longitude: demo.lng,
          reporterId: users[demo.reporter].id,
          authorityId: authority ? authorities[authority] ?? null : null,
          createdAt,
        },
      });

      if (demo.evidenceUrl) {
        await tx.evidence.create({
          data: {
            issueId: issue.id,
            type: 'URL',
            url: demo.evidenceUrl,
            fileName: demo.evidenceUrl.split('/').pop(),
            uploadedById: users[demo.reporter].id,
            metadata: { demo: true },
            createdAt,
          },
        });
      }

      if (demo.promise && authority) {
        await tx.promise.create({
          data: {
            issueId: issue.id,
            authorityId: authorities[authority] ?? null,
            deadline: new Date(now + demo.promise.daysFromNow * dayMs),
            status: demo.promise.status,
            description: 'DEMO promise seeded for development.',
            createdAt,
          },
        });
      }

      const flow = statusFlow[demo.status] ?? [];
      await tx.auditLog.create({
        data: {
          actorId: users[demo.reporter].id,
          issueId: issue.id,
          action: 'REPORT_CREATED',
          entityType: 'Issue',
          entityId: issue.id,
          metadata: { publicId, demo: true },
          createdAt,
        },
      });
      for (const step of flow) {
        const nextStep = flow[flow.indexOf(step) + 1] ?? demo.status;
        await tx.auditLog.create({
          data: {
            actorId: users.authority.id,
            issueId: issue.id,
            action: 'STATUS_CHANGED',
            entityType: 'Issue',
            entityId: issue.id,
            metadata: { from: step, to: nextStep, demo: true },
            createdAt: new Date(createdAt.getTime() + (flow.indexOf(step) + 1) * dayMs),
          },
        });
      }
      if (flow.includes('VERIFIED') && authority) {
        await tx.auditLog.create({
          data: {
            actorId: users.authority.id,
            issueId: issue.id,
            action: 'AUTHORITY_ASSIGNED',
            entityType: 'Issue',
            entityId: issue.id,
            metadata: { department: authority, demo: true },
            createdAt: new Date(createdAt.getTime() + 2 * dayMs),
          },
        });
      }

      await tx.notification.create({
        data: {
          userId: users[demo.reporter].id,
          issueId: issue.id,
          type: 'REPORT_CREATED',
          title: `Report ${publicId} received`,
          message: 'DEMO — Your civic report was recorded.',
          read: index % 2 === 0,
          createdAt,
        },
      });
      if (demo.status !== 'SUBMITTED') {
        await tx.notification.create({
          data: {
            userId: users[demo.reporter].id,
            issueId: issue.id,
            type: 'STATUS_CHANGED',
            title: `Report ${publicId} is now ${demo.status.replace(/_/g, ' ').toLowerCase()}`,
            message: 'DEMO — Status updated on this report.',
            read: false,
            createdAt: new Date(createdAt.getTime() + 1 * dayMs),
          },
        });
      }

      console.log(`[seed]   issue ${publicId}  ${demo.category}  ${demo.status}  reporter=${demo.reporter}`);
    }

    await tx.notification.create({
      data: {
        userId: users.admin.id,
        type: 'GENERAL',
        title: 'Demo dataset seeded',
        message: 'DEMO — Development data was loaded into this database.',
        read: false,
      },
    });
    });
  }

  // Demo verification + escalation queues. Seeded idempotently (outside the
  // issue-creation skip) so the queues have honest PENDING/OPEN demo rows even
  // on databases where the demo issues already exist.
  const demoEvidenceFor = async (publicId: string) =>
    prisma.evidence.findFirst({ where: { issue: { publicId } } });

  const cc1090Evidence = await demoEvidenceFor('CC-1090');
  if (cc1090Evidence) {
    const existing = await prisma.verification.count({ where: { evidenceId: cc1090Evidence.id } });
    if (existing === 0) {
      await prisma.verification.create({
        data: {
          issueId: cc1090Evidence.issueId,
          verifierId: users.authority.id,
          evidenceId: cc1090Evidence.id,
          status: 'VERIFIED',
          note: 'DEMO — Photo matches the reported pothole location.',
        },
      });
      await prisma.auditLog.create({
        data: {
          actorId: users.authority.id,
          issueId: cc1090Evidence.issueId,
          action: 'VERIFICATION_CREATED',
          entityType: 'Evidence',
          entityId: cc1090Evidence.id,
          metadata: { status: 'VERIFIED', demo: true },
        },
      });
    }
  }

  const cc1092Evidence = await demoEvidenceFor('CC-1092');
  if (cc1092Evidence) {
    const existing = await prisma.verification.count({ where: { evidenceId: cc1092Evidence.id } });
    if (existing === 0) {
      await prisma.verification.create({
        data: {
          issueId: cc1092Evidence.issueId,
          verifierId: users.authority.id,
          evidenceId: cc1092Evidence.id,
          status: 'PENDING',
          note: 'DEMO — Seeded pending verification for the development queue.',
        },
      });
      await prisma.auditLog.create({
        data: {
          actorId: users.authority.id,
          issueId: cc1092Evidence.issueId,
          action: 'VERIFICATION_CREATED',
          entityType: 'Evidence',
          entityId: cc1092Evidence.id,
          metadata: { status: 'PENDING', demo: true },
        },
      });
    }
  }

  const cc1093 = await prisma.issue.findFirst({ where: { publicId: 'CC-1093' } });
  if (cc1093) {
    const existing = await prisma.escalation.count({ where: { issueId: cc1093.id } });
    if (existing === 0) {
      await prisma.escalation.create({
        data: {
          issueId: cc1093.id,
          callerId: users.ravi.id,
          authorityId: authorities['Roads & Infrastructure Department'] ?? null,
          level: 1,
          status: 'OPEN',
          reason: 'DEMO — Repeated overflow despite a broken repair promise.',
        },
      });
      await prisma.auditLog.create({
        data: {
          actorId: users.ravi.id,
          issueId: cc1093.id,
          action: 'ESCALATION_CREATED',
          entityType: 'Escalation',
          entityId: cc1093.id,
          metadata: { level: 1, demo: true },
        },
      });
    }
  }

  console.log(
    existing === 0
      ? `[seed] Inserted ${demoIssues.length} demo issues. Sign in via magic link at the seeded emails.`
      : '[seed] Demo issues already present — only verification/escalation queues refreshed.',
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('[seed] Done.');
  })
  .catch(async (error) => {
    console.error('[seed] Failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });