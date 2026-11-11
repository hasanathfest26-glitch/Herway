import {
  PrismaClient,
  UserRole,
  SafeHavenCategory,
  SafeHavenApprovalStatus,
  VerificationStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('HerwayPilot@2026', 10);

  // 1. Platform Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@herway.in' },
    update: {},
    create: {
      email: 'admin@herway.in',
      passwordHash,
      fullName: 'Meera Nair (Safety Admin)',
      homeCity: 'Kochi',
      roles: [UserRole.ADMIN, UserRole.TRAVELLER],
      languages: ['English', 'Malayalam'],
      discoverableAsTraveller: false,
    },
  });

  // 2. Pilot Traveller in Kochi
  const traveller = await prisma.user.upsert({
    where: { email: 'ananya@herway.in' },
    update: {},
    create: {
      email: 'ananya@herway.in',
      passwordHash,
      fullName: 'Ananya Menon',
      dateOfBirth: new Date('1998-05-14'),
      homeCity: 'Kochi',
      bio: 'Solo backpacker exploring Fort Kochi, backwaters and hill stations.',
      languages: ['English', 'Malayalam', 'Hindi'],
      interests: ['Heritage Walks', 'Photography', 'Cafes', 'Backwaters'],
      roles: [UserRole.TRAVELLER],
      approxLatitude: 9.9658,
      approxLongitude: 76.2421,
    },
  });

  // 3. Verified Travel Buddy (18+ woman) in Kochi
  const buddyUser = await prisma.user.upsert({
    where: { email: 'lakshmi.buddy@herway.in' },
    update: {},
    create: {
      email: 'lakshmi.buddy@herway.in',
      passwordHash,
      fullName: 'Lakshmi Pillai',
      dateOfBirth: new Date('1995-09-21'),
      homeCity: 'Kochi',
      bio: 'Certified Fort Kochi & Mattancherry local companion. Fluent in Malayalam, English & Tamil.',
      languages: ['Malayalam', 'English', 'Tamil'],
      interests: ['Cultural Tours', 'Local Food', 'Art Galleries', 'Safe Transit'],
      roles: [UserRole.TRAVELLER, UserRole.TRAVEL_BUDDY],
      approxLatitude: 9.9675,
      approxLongitude: 76.245,
    },
  });

  await prisma.travelBuddyProfile.upsert({
    where: { userId: buddyUser.id },
    update: {},
    create: {
      userId: buddyUser.id,
      headline: 'Fort Kochi & Marine Drive Local Companion',
      servicesOffered: ['City Orientation', 'Airport Pickup Escort', 'Market Visits', 'Language Help'],
      languages: ['Malayalam', 'English', 'Tamil'],
      hourlyRateInr: 650,
      city: 'Kochi',
      baseLatitude: 9.9675,
      baseLongitude: 76.245,
      ratingAverage: 4.9,
      reviewCount: 18,
      isVerified: true,
      verifiedAt: new Date(),
    },
  });

  // 4. Safe Haven Partner Account & Approved + 10 Demo Safe Haven Records
  const partnerUser = await prisma.user.upsert({
    where: { email: 'partner@fortkochisafestay.in' },
    update: {},
    create: {
      email: 'partner@fortkochisafestay.in',
      passwordHash,
      fullName: 'Fort Kochi Heritage Stay Management',
      homeCity: 'Kochi',
      roles: [UserRole.SAFE_HAVEN_PARTNER],
      discoverableAsTraveller: false,
    },
  });

  const demoHavens = [
    {
      name: 'Malabar Care Hospital',
      category: SafeHavenCategory.HOSPITAL,
      city: 'Kannur',
      address: 'Demo Plot 101, Station Road, Kannur (Placeholder Address)',
      latitude: 11.8745,
      longitude: 75.3704,
      phone: '+91-000-000-0101',
      contactEmail: 'demo-malabarcare@example.invalid',
      operatingHoursJson: { open24Hours: true, display: '24/7 Emergency Desk (Demo)' },
      assistanceServices: ['Emergency Triage', 'Women Doctor On Call', 'Safe Waiting Area'],
      licenceNumber: 'DEMO-KL-HOSP-0001',
    },
    {
      name: 'Kannur Women’s Clinic',
      category: SafeHavenCategory.CLINIC,
      city: 'Kannur',
      address: 'Demo Suite 202, Civil Station Link Rd, Kannur (Placeholder Address)',
      latitude: 11.8781,
      longitude: 75.3672,
      phone: '+91-000-000-0102',
      contactEmail: 'demo-kannurwomens@example.invalid',
      operatingHoursJson: { open24Hours: false, display: '08:00 AM - 09:00 PM' },
      assistanceServices: ['Women Healthcare Desk', 'First Aid', 'Safe Rest Room'],
      licenceNumber: 'DEMO-KL-CLIN-0002',
    },
    {
      name: 'Coastal Medical Centre',
      category: SafeHavenCategory.HOSPITAL,
      city: 'Kannur',
      address: 'Demo Block 303, Payyambalam Beach Rd, Kannur (Placeholder Address)',
      latitude: 11.8798,
      longitude: 75.3522,
      phone: '+91-000-000-0103',
      contactEmail: 'demo-coastalmed@example.invalid',
      operatingHoursJson: { open24Hours: true, display: 'Open 24 Hours (Demo)' },
      assistanceServices: ['24/7 Urgent Care', 'Ambulance Desk', 'Phone Charging'],
      licenceNumber: 'DEMO-KL-HOSP-0003',
    },
    {
      name: 'Green Leaf Pharmacy',
      category: SafeHavenCategory.PHARMACY,
      city: 'Kannur',
      address: 'Demo Shop 404, Fort Road, Kannur (Placeholder Address)',
      latitude: 11.8705,
      longitude: 75.3638,
      phone: '+91-000-000-0104',
      contactEmail: 'demo-greenleaf@example.invalid',
      operatingHoursJson: { open24Hours: false, display: '07:00 AM - 11:00 PM' },
      assistanceServices: ['Essential Medicines', 'First Aid Kit', 'Emergency Call Help'],
      licenceNumber: 'DEMO-KL-PHAR-0004',
    },
    {
      name: 'City Health Pharmacy',
      category: SafeHavenCategory.PHARMACY,
      city: 'Kozhikode',
      address: 'Demo Unit 505, Mavoor Road, Kozhikode (Placeholder Address)',
      latitude: 11.2588,
      longitude: 75.7804,
      phone: '+91-000-000-0105',
      contactEmail: 'demo-cityhealth@example.invalid',
      operatingHoursJson: { open24Hours: true, display: '24/7 Pharmacy Counter (Demo)' },
      assistanceServices: ['24/7 Pharmacy', 'Well-lit Entrance', 'Cab Calling Help'],
      licenceNumber: 'DEMO-KL-PHAR-0005',
    },
    {
      name: "Safe Stay Women's Hostel",
      category: SafeHavenCategory.HOSTEL,
      city: 'Kannur',
      address: 'Demo Building 606, Thavakkara, Kannur (Placeholder Address)',
      latitude: 11.8722,
      longitude: 75.3749,
      phone: '+91-000-000-0106',
      contactEmail: 'demo-safestay@example.invalid',
      operatingHoursJson: { open24Hours: true, display: '24/7 Warden & Reception' },
      assistanceServices: ['24/7 Safe Waiting Lounge', 'Women Staffed Desk', 'Wi-Fi & Charging'],
      licenceNumber: 'DEMO-KL-HOST-0006',
    },
    {
      name: 'Malabar Tourist Help Centre',
      category: SafeHavenCategory.TOURIST_ASSISTANCE_CENTRE,
      city: 'Kozhikode',
      address: 'Demo Kiosk 707, Beach Promenade, Kozhikode (Placeholder Address)',
      latitude: 11.2626,
      longitude: 75.7672,
      phone: '+91-000-000-0107',
      contactEmail: 'demo-malabartourist@example.invalid',
      operatingHoursJson: { open24Hours: false, display: '07:30 AM - 09:30 PM' },
      assistanceServices: ['Route Guidance', 'Verified Transit Help', 'Rest Lounge'],
      licenceNumber: 'DEMO-KL-TAC-0007',
    },
    {
      name: 'Kannur Family Health Centre',
      category: SafeHavenCategory.CLINIC,
      city: 'Kannur',
      address: 'Demo Wing 808, South Bazar, Kannur (Placeholder Address)',
      latitude: 11.8689,
      longitude: 75.3718,
      phone: '+91-000-000-0108',
      contactEmail: 'demo-kannurfamily@example.invalid',
      operatingHoursJson: { open24Hours: false, display: '08:00 AM - 08:30 PM' },
      assistanceServices: ['Primary Clinic', 'First Aid', 'Local Language Support'],
      licenceNumber: 'DEMO-KL-CLIN-0008',
    },
    {
      name: 'North Gate Medical Centre',
      category: SafeHavenCategory.HOSPITAL,
      city: 'Wayanad',
      address: 'Demo Campus 909, Kalpetta Bypass, Wayanad (Placeholder Address)',
      latitude: 11.6085,
      longitude: 76.0831,
      phone: '+91-000-000-0109',
      contactEmail: 'demo-northgate@example.invalid',
      operatingHoursJson: { open24Hours: true, display: '24/7 Medical Desk (Demo)' },
      assistanceServices: ['Emergency Triage', 'Safe Waiting Area', '112 Coordination'],
      licenceNumber: 'DEMO-KL-HOSP-0009',
    },
    {
      name: 'Blue Haven Residency',
      category: SafeHavenCategory.HOTEL,
      city: 'Kochi',
      address: 'Demo Tower 1010, Marine Drive Link, Kochi (Placeholder Address)',
      latitude: 9.9742,
      longitude: 76.2775,
      phone: '+91-000-000-0110',
      contactEmail: 'demo-bluehaven@example.invalid',
      operatingHoursJson: { open24Hours: true, display: '24/7 Front Desk' },
      assistanceServices: ['24/7 Staffed Lobby', 'Phone Charging & Wi-Fi', 'Verified Taxi Desk'],
      licenceNumber: 'DEMO-KL-HOTL-0010',
    },
  ];

  const existingHavens = await prisma.safeHaven.count();
  if (existingHavens === 0) {
    await prisma.safeHaven.createMany({
      data: [
        {
          partnerUserId: partnerUser.id,
          name: 'Fort Kochi Women-Friendly Heritage Stay',
          category: SafeHavenCategory.HOTEL,
          description: '24/7 staffed lobby, verified safe waiting lounge, phone charging, and emergency taxi coordination.',
          address: 'Princess Street, Fort Kochi, Ernakulam, Kerala 682001',
          city: 'Kochi',
          latitude: 9.9653,
          longitude: 76.2426,
          phone: '+91-484-2215001',
          contactEmail: 'desk@fortkochisafestay.in',
          operatingHoursJson: { open24Hours: true, display: 'Open 24 Hours' },
          assistanceServices: ['24/7 Safe Waiting Lounge', 'Phone Charging & Wi-Fi', 'Verified Cab Calling', 'First Aid'],
          licenceNumber: 'KL-DOT-EKM-2026-0142',
          approvalStatus: SafeHavenApprovalStatus.APPROVED,
          verifiedBadge: true,
          isDemoData: false,
          isActive: true,
          approvedAt: new Date(),
          lastRecheckedAt: new Date(),
        },
        ...demoHavens.map((d) => ({
          partnerUserId: partnerUser.id,
          name: d.name,
          category: d.category,
          description: 'DEMO DATA — NOT VERIFIED PARTNERS. Placeholder establishment for Explore, filters, details, and map testing.',
          logoUrl: 'https://placehold.co/120x120/e9f7f7/0099a8?text=DEMO',
          address: d.address,
          city: d.city,
          latitude: d.latitude,
          longitude: d.longitude,
          phone: d.phone,
          contactEmail: d.contactEmail,
          operatingHoursJson: d.operatingHoursJson,
          assistanceServices: d.assistanceServices,
          licenceNumber: d.licenceNumber,
          verificationDocumentsJson: {
            registrationCertificate: `${d.licenceNumber}-cert.pdf (Demo)`,
            premiseVerification: 'Pending Admin Review',
          },
          partnershipAgreementJson: {
            accepted: false,
            status: 'Pending Partner Verification (Demo)',
          },
          approvalStatus: SafeHavenApprovalStatus.PENDING,
          verifiedBadge: false,
          isDemoData: true,
          isActive: true,
          approvalNotes: 'DEMO DATA — NOT VERIFIED PARTNERS (Awaiting admin review)',
        })),
      ],
    });
  }

  // 6. Sample Trusted Contacts & Active Trip for Ananya
  const contactCount = await prisma.trustedContact.count({ where: { userId: traveller.id } });
  if (contactCount === 0) {
    await prisma.trustedContact.createMany({
      data: [
        {
          userId: traveller.id,
          name: 'Radha Menon (Mother)',
          relationship: 'Mother',
          phone: '+919847011223',
          email: 'radha.menon@example.in',
          canReceiveTripUpdates: true,
          canViewLocation: true,
          canReceiveCheckIns: true,
          canReceiveSos: true,
        },
        {
          userId: traveller.id,
          name: 'Divya Krishnan',
          relationship: 'Sister',
          phone: '+919895044556',
          canReceiveTripUpdates: true,
          canViewLocation: true,
          canReceiveCheckIns: false,
          canReceiveSos: true,
        },
      ],
    });
  }

  // 7. Pending Verification Sample for Admin queue
  const pendingCount = await prisma.verificationApplication.count({
    where: { status: VerificationStatus.PENDING },
  });
  if (pendingCount === 0) {
    await prisma.verificationApplication.create({
      data: {
        userId: traveller.id,
        role: UserRole.TRAVEL_BUDDY,
        liveSelfiePath: 'verification-private/ananya-selfie-live.jpg',
        idDocumentPath: 'verification-private/ananya-id-masked.pdf',
        ageVerified18Plus: true,
        notes: 'Applying to become a weekend Kochi Travel Buddy.',
        status: VerificationStatus.PENDING,
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: 'PILOT_SEED_INITIALIZED',
      targetType: 'SYSTEM',
      detailsJson: { pilotCities: ['Kochi', 'Kozhikode', 'Munnar', 'Wayanad'] },
    },
  });

  console.log('Herway Kerala pilot seed completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
