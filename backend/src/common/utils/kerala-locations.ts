export interface KeralaLocation {
  name: string;
  district: string;
  latitude: number;
  longitude: number;
}

export const KERALA_LOCATIONS: KeralaLocation[] = [
  { name: 'Thiruvananthapuram', district: 'Thiruvananthapuram', latitude: 8.5241, longitude: 76.9366 },
  { name: 'Kollam', district: 'Kollam', latitude: 8.8932, longitude: 76.6141 },
  { name: 'Pathanamthitta', district: 'Pathanamthitta', latitude: 9.2648, longitude: 76.787 },
  { name: 'Alappuzha', district: 'Alappuzha', latitude: 9.4981, longitude: 76.3388 },
  { name: 'Kottayam', district: 'Kottayam', latitude: 9.5916, longitude: 76.5222 },
  { name: 'Idukki', district: 'Idukki', latitude: 9.9189, longitude: 77.1025 },
  { name: 'Ernakulam', district: 'Ernakulam', latitude: 9.9816, longitude: 76.2999 },
  { name: 'Kochi', district: 'Ernakulam', latitude: 9.9658, longitude: 76.2421 },
  { name: 'Thrissur', district: 'Thrissur', latitude: 10.5276, longitude: 76.2144 },
  { name: 'Palakkad', district: 'Palakkad', latitude: 10.7867, longitude: 76.6548 },
  { name: 'Malappuram', district: 'Malappuram', latitude: 11.051, longitude: 76.0711 },
  { name: 'Kozhikode', district: 'Kozhikode', latitude: 11.2588, longitude: 75.7804 },
  { name: 'Wayanad', district: 'Wayanad', latitude: 11.6854, longitude: 76.132 },
  { name: 'Kannur', district: 'Kannur', latitude: 11.8745, longitude: 75.3704 },
  { name: 'Kasaragod', district: 'Kasaragod', latitude: 12.4996, longitude: 74.9869 },
  { name: 'Munnar', district: 'Idukki', latitude: 10.0889, longitude: 77.0595 },
  { name: 'Varkala', district: 'Thiruvananthapuram', latitude: 8.7379, longitude: 76.7163 },
  { name: 'Kovalam', district: 'Thiruvananthapuram', latitude: 8.4004, longitude: 76.9787 },
  { name: 'Thekkady', district: 'Idukki', latitude: 9.6031, longitude: 77.1615 },
  { name: 'Bekal', district: 'Kasaragod', latitude: 12.393, longitude: 75.0338 },
];

export function resolveKeralaCoordinates(
  cityName?: string | null,
): { latitude: number; longitude: number } | null {
  if (!cityName) return null;
  const clean = cityName.trim().toLowerCase();
  if (!clean) return null;
  const match = KERALA_LOCATIONS.find(
    (loc) =>
      loc.name.toLowerCase() === clean ||
      loc.district.toLowerCase() === clean ||
      clean.includes(loc.name.toLowerCase()) ||
      loc.name.toLowerCase().includes(clean),
  );
  return match ? { latitude: match.latitude, longitude: match.longitude } : null;
}
