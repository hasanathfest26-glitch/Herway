import { ImageSourcePropType } from 'react-native';

export type CatalogKind = 'SAFE_HAVEN' | 'BUDDY' | 'MAP_PLACE';

export type SafeHavenApprovalState = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export interface SafeHavenRecord {
  id: string;
  name: string;
  category:
    | 'HOSPITAL'
    | 'CLINIC'
    | 'PHARMACY'
    | 'HOSTEL'
    | 'TOURIST_ASSISTANCE_CENTRE'
    | 'HOTEL';
  city: string;
  logoUrl?: string | null;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  contactEmail?: string | null;
  operatingHoursJson?: { open24Hours?: boolean; display?: string };
  assistanceServices: string[];
  licenceNumber: string;
  verificationDocuments?: string[];
  partnershipAgreementStatus?: string;
  approvalStatus: SafeHavenApprovalState;
  approvalNotes?: string | null;
  lastVerifiedAt?: string | null;
  verifiedBadge: boolean;
  isDemoData?: boolean;
  distanceKm?: number | null;
}

export interface HerwayCatalogItem {
  id: string;
  kind: CatalogKind;
  badgeText: string;
  title: string;
  subtitle: string;
  city: string;
  locationLabel: string;
  distanceLabel: string;
  rating: number;
  priceOrStatusValue: string;
  priceOrStatusUnit: string;
  chips: string[];
  description: string;
  image: ImageSourcePropType;
  heroImage: ImageSourcePropType;
  extraCountLabel: string;
  ctaLabel: string;
  lat: number;
  lng: number;
  phone?: string;
  verifiedSafeHaven: boolean;
  isDemoData?: boolean;
  languages?: string[];
  hourlyRateInr?: number;
}

export const PILOT_CITIES = [
  'Thiruvananthapuram',
  'Kollam',
  'Pathanamthitta',
  'Alappuzha',
  'Kottayam',
  'Idukki',
  'Ernakulam',
  'Kochi',
  'Thrissur',
  'Palakkad',
  'Malappuram',
  'Kozhikode',
  'Wayanad',
  'Kannur',
  'Kasaragod',
  'Munnar',
  'Varkala',
  'Kovalam',
  'Thekkady',
  'Bekal',
] as const;

export const KERALA_LOCATION_COORDS: Record<string, { latitude: number; longitude: number }> = {
  Thiruvananthapuram: { latitude: 8.5241, longitude: 76.9366 },
  Kollam: { latitude: 8.8932, longitude: 76.6141 },
  Pathanamthitta: { latitude: 9.2648, longitude: 76.787 },
  Alappuzha: { latitude: 9.4981, longitude: 76.3388 },
  Kottayam: { latitude: 9.5916, longitude: 76.5222 },
  Idukki: { latitude: 9.9189, longitude: 77.1025 },
  Ernakulam: { latitude: 9.9816, longitude: 76.2999 },
  Kochi: { latitude: 9.9658, longitude: 76.2421 },
  Thrissur: { latitude: 10.5276, longitude: 76.2144 },
  Palakkad: { latitude: 10.7867, longitude: 76.6548 },
  Malappuram: { latitude: 11.051, longitude: 76.0711 },
  Kozhikode: { latitude: 11.2588, longitude: 75.7804 },
  Wayanad: { latitude: 11.6854, longitude: 76.132 },
  Kannur: { latitude: 11.8745, longitude: 75.3704 },
  Kasaragod: { latitude: 12.4996, longitude: 74.9869 },
  Munnar: { latitude: 10.0889, longitude: 77.0595 },
  Varkala: { latitude: 8.7379, longitude: 76.7163 },
  Kovalam: { latitude: 8.4004, longitude: 76.9787 },
  Thekkady: { latitude: 9.6031, longitude: 77.1615 },
  Bekal: { latitude: 12.393, longitude: 75.0338 },
};

export function resolveMobileLocationCoords(
  cityName?: string | null,
): { latitude: number; longitude: number } | null {
  if (!cityName) return null;
  const clean = cityName.trim().toLowerCase();
  const entry = Object.entries(KERALA_LOCATION_COORDS).find(
    ([name]) =>
      name.toLowerCase() === clean ||
      clean.includes(name.toLowerCase()) ||
      name.toLowerCase().includes(clean),
  );
  return entry ? entry[1] : null;
}

/**
 * 10 Fictional Demo Safe Haven records for Explore, details, filters & map testing.
 * Strictly marked DEMO DATA — NOT VERIFIED PARTNERS with approvalStatus: 'PENDING' and verifiedBadge: false.
 * Placeholder addresses, coordinates & contact details only.
 */
export const DEMO_SAFE_HAVENS: SafeHavenRecord[] = [
  {
    id: 'demo-sh-1',
    name: 'Malabar Care Hospital',
    category: 'HOSPITAL',
    city: 'Kannur',
    logoUrl: 'https://placehold.co/120x120/e9f7f7/0099a8?text=MC',
    address: 'Demo Plot 101, Station Road, Kannur (Placeholder Address)',
    latitude: 11.8745,
    longitude: 75.3704,
    phone: '+91-000-000-0101',
    contactEmail: 'demo-malabarcare@example.invalid',
    operatingHoursJson: { open24Hours: true, display: '24/7 Emergency Desk (Demo)' },
    assistanceServices: ['Emergency Triage', 'Women Doctor On Call', 'Safe Waiting Area'],
    licenceNumber: 'DEMO-KL-HOSP-0001',
    verificationDocuments: ['Hospital Registration (Demo)', 'Fire & Safety NOC (Demo)'],
    partnershipAgreementStatus: 'Pending Partner Verification (Demo)',
    approvalStatus: 'PENDING',
    approvalNotes: 'DEMO DATA — NOT VERIFIED PARTNERS (Pending admin review)',
    lastVerifiedAt: null,
    verifiedBadge: false,
    isDemoData: true,
  },
  {
    id: 'demo-sh-2',
    name: 'Kannur Women’s Clinic',
    category: 'CLINIC',
    city: 'Kannur',
    logoUrl: 'https://placehold.co/120x120/e9f7f7/0099a8?text=KW',
    address: 'Demo Suite 202, Civil Station Link Rd, Kannur (Placeholder Address)',
    latitude: 11.8781,
    longitude: 75.3672,
    phone: '+91-000-000-0102',
    contactEmail: 'demo-kannurwomens@example.invalid',
    operatingHoursJson: { open24Hours: false, display: '08:00 AM – 09:00 PM' },
    assistanceServices: ['Women Healthcare Desk', 'First Aid', 'Safe Rest Room'],
    licenceNumber: 'DEMO-KL-CLIN-0002',
    verificationDocuments: ['Clinical Establishment Cert (Demo)', 'ID Proof (Demo)'],
    partnershipAgreementStatus: 'Pending Partner Verification (Demo)',
    approvalStatus: 'PENDING',
    approvalNotes: 'DEMO DATA — NOT VERIFIED PARTNERS (Pending admin review)',
    lastVerifiedAt: null,
    verifiedBadge: false,
    isDemoData: true,
  },
  {
    id: 'demo-sh-3',
    name: 'Coastal Medical Centre',
    category: 'HOSPITAL',
    city: 'Kannur',
    logoUrl: 'https://placehold.co/120x120/e9f7f7/0099a8?text=CM',
    address: 'Demo Block 303, Payyambalam Beach Rd, Kannur (Placeholder Address)',
    latitude: 11.8798,
    longitude: 75.3522,
    phone: '+91-000-000-0103',
    contactEmail: 'demo-coastalmed@example.invalid',
    operatingHoursJson: { open24Hours: true, display: 'Open 24 Hours (Demo)' },
    assistanceServices: ['24/7 Urgent Care', 'Ambulance Desk', 'Phone Charging'],
    licenceNumber: 'DEMO-KL-HOSP-0003',
    verificationDocuments: ['Medical Licence (Demo)', 'Safety Audit Form (Demo)'],
    partnershipAgreementStatus: 'Pending Partner Verification (Demo)',
    approvalStatus: 'PENDING',
    approvalNotes: 'DEMO DATA — NOT VERIFIED PARTNERS (Pending admin review)',
    lastVerifiedAt: null,
    verifiedBadge: false,
    isDemoData: true,
  },
  {
    id: 'demo-sh-4',
    name: 'Green Leaf Pharmacy',
    category: 'PHARMACY',
    city: 'Kannur',
    logoUrl: 'https://placehold.co/120x120/e9f7f7/0099a8?text=GL',
    address: 'Demo Shop 404, Fort Road, Kannur (Placeholder Address)',
    latitude: 11.8705,
    longitude: 75.3638,
    phone: '+91-000-000-0104',
    contactEmail: 'demo-greenleaf@example.invalid',
    operatingHoursJson: { open24Hours: false, display: '07:00 AM – 11:00 PM' },
    assistanceServices: ['Essential Medicines', 'First Aid Kit', 'Emergency Call Help'],
    licenceNumber: 'DEMO-KL-PHAR-0004',
    verificationDocuments: ['Retail Drug Licence (Demo)', 'Storefront Photo (Demo)'],
    partnershipAgreementStatus: 'Pending Partner Verification (Demo)',
    approvalStatus: 'PENDING',
    approvalNotes: 'DEMO DATA — NOT VERIFIED PARTNERS (Pending admin review)',
    lastVerifiedAt: null,
    verifiedBadge: false,
    isDemoData: true,
  },
  {
    id: 'demo-sh-5',
    name: 'City Health Pharmacy',
    category: 'PHARMACY',
    city: 'Kozhikode',
    logoUrl: 'https://placehold.co/120x120/e9f7f7/0099a8?text=CH',
    address: 'Demo Unit 505, Mavoor Road, Kozhikode (Placeholder Address)',
    latitude: 11.2588,
    longitude: 75.7804,
    phone: '+91-000-000-0105',
    contactEmail: 'demo-cityhealth@example.invalid',
    operatingHoursJson: { open24Hours: true, display: '24/7 Pharmacy Counter (Demo)' },
    assistanceServices: ['24/7 Pharmacy', 'Well-lit Entrance', 'Cab Calling Help'],
    licenceNumber: 'DEMO-KL-PHAR-0005',
    verificationDocuments: ['Pharmacy Registration (Demo)', 'Owner KYC (Demo)'],
    partnershipAgreementStatus: 'Pending Partner Verification (Demo)',
    approvalStatus: 'PENDING',
    approvalNotes: 'DEMO DATA — NOT VERIFIED PARTNERS (Pending admin review)',
    lastVerifiedAt: null,
    verifiedBadge: false,
    isDemoData: true,
  },
  {
    id: 'demo-sh-6',
    name: "Safe Stay Women's Hostel",
    category: 'HOSTEL',
    city: 'Kannur',
    logoUrl: 'https://placehold.co/120x120/e9f7f7/0099a8?text=SS',
    address: 'Demo Building 606, Thavakkara, Kannur (Placeholder Address)',
    latitude: 11.8722,
    longitude: 75.3749,
    phone: '+91-000-000-0106',
    contactEmail: 'demo-safestay@example.invalid',
    operatingHoursJson: { open24Hours: true, display: '24/7 Warden & Reception' },
    assistanceServices: ['24/7 Safe Waiting Lounge', 'Women Staffed Desk', 'Wi-Fi & Charging'],
    licenceNumber: 'DEMO-KL-HOST-0006',
    verificationDocuments: ['Hostel Permit (Demo)', 'CCTV & Lighting Checklist (Demo)'],
    partnershipAgreementStatus: 'Pending Partner Verification (Demo)',
    approvalStatus: 'PENDING',
    approvalNotes: 'DEMO DATA — NOT VERIFIED PARTNERS (Pending admin review)',
    lastVerifiedAt: null,
    verifiedBadge: false,
    isDemoData: true,
  },
  {
    id: 'demo-sh-7',
    name: 'Malabar Tourist Help Centre',
    category: 'TOURIST_ASSISTANCE_CENTRE',
    city: 'Kozhikode',
    logoUrl: 'https://placehold.co/120x120/e9f7f7/0099a8?text=MT',
    address: 'Demo Kiosk 707, Beach Promenade, Kozhikode (Placeholder Address)',
    latitude: 11.2626,
    longitude: 75.7672,
    phone: '+91-000-000-0107',
    contactEmail: 'demo-malabartourist@example.invalid',
    operatingHoursJson: { open24Hours: false, display: '07:30 AM – 09:30 PM' },
    assistanceServices: ['Route Guidance', 'Verified Transit Help', 'Rest Lounge'],
    licenceNumber: 'DEMO-KL-TAC-0007',
    verificationDocuments: ['Tourism Desk Authorization (Demo)'],
    partnershipAgreementStatus: 'Pending Partner Verification (Demo)',
    approvalStatus: 'PENDING',
    approvalNotes: 'DEMO DATA — NOT VERIFIED PARTNERS (Pending admin review)',
    lastVerifiedAt: null,
    verifiedBadge: false,
    isDemoData: true,
  },
  {
    id: 'demo-sh-8',
    name: 'Kannur Family Health Centre',
    category: 'CLINIC',
    city: 'Kannur',
    logoUrl: 'https://placehold.co/120x120/e9f7f7/0099a8?text=KF',
    address: 'Demo Wing 808, South Bazar, Kannur (Placeholder Address)',
    latitude: 11.8689,
    longitude: 75.3718,
    phone: '+91-000-000-0108',
    contactEmail: 'demo-kannurfamily@example.invalid',
    operatingHoursJson: { open24Hours: false, display: '08:00 AM – 08:30 PM' },
    assistanceServices: ['Primary Clinic', 'First Aid', 'Local Language Support'],
    licenceNumber: 'DEMO-KL-CLIN-0008',
    verificationDocuments: ['Clinic Registration (Demo)'],
    partnershipAgreementStatus: 'Pending Partner Verification (Demo)',
    approvalStatus: 'PENDING',
    approvalNotes: 'DEMO DATA — NOT VERIFIED PARTNERS (Pending admin review)',
    lastVerifiedAt: null,
    verifiedBadge: false,
    isDemoData: true,
  },
  {
    id: 'demo-sh-9',
    name: 'North Gate Medical Centre',
    category: 'HOSPITAL',
    city: 'Wayanad',
    logoUrl: 'https://placehold.co/120x120/e9f7f7/0099a8?text=NG',
    address: 'Demo Campus 909, Kalpetta Bypass, Wayanad (Placeholder Address)',
    latitude: 11.6085,
    longitude: 76.0831,
    phone: '+91-000-000-0109',
    contactEmail: 'demo-northgate@example.invalid',
    operatingHoursJson: { open24Hours: true, display: '24/7 Medical Desk (Demo)' },
    assistanceServices: ['Emergency Triage', 'Safe Waiting Area', '112 Coordination'],
    licenceNumber: 'DEMO-KL-HOSP-0009',
    verificationDocuments: ['Hospital Permit (Demo)', 'Emergency Desk Roster (Demo)'],
    partnershipAgreementStatus: 'Pending Partner Verification (Demo)',
    approvalStatus: 'PENDING',
    approvalNotes: 'DEMO DATA — NOT VERIFIED PARTNERS (Pending admin review)',
    lastVerifiedAt: null,
    verifiedBadge: false,
    isDemoData: true,
  },
  {
    id: 'demo-sh-10',
    name: 'Blue Haven Residency',
    category: 'HOTEL',
    city: 'Kochi',
    logoUrl: 'https://placehold.co/120x120/e9f7f7/0099a8?text=BH',
    address: 'Demo Tower 1010, Marine Drive Link, Kochi (Placeholder Address)',
    latitude: 9.9742,
    longitude: 76.2775,
    phone: '+91-000-000-0110',
    contactEmail: 'demo-bluehaven@example.invalid',
    operatingHoursJson: { open24Hours: true, display: '24/7 Front Desk' },
    assistanceServices: ['24/7 Staffed Lobby', 'Phone Charging & Wi-Fi', 'Verified Taxi Desk'],
    licenceNumber: 'DEMO-KL-HOTL-0010',
    verificationDocuments: ['Hotel Trade Licence (Demo)', 'Reception Safety Form (Demo)'],
    partnershipAgreementStatus: 'Pending Partner Verification (Demo)',
    approvalStatus: 'PENDING',
    approvalNotes: 'DEMO DATA — NOT VERIFIED PARTNERS (Pending admin review)',
    lastVerifiedAt: null,
    verifiedBadge: false,
    isDemoData: true,
  },
];
