const API_BASE = "https://geocode.maps.co/reverse";

const api_key = process.env.MAPSCO_API_KEY;
if (!api_key) throw new Error("MAPSCO_API_KEY not defined");

export async function reverseGeocode(lat: number, lon: number) {
  const url = `${API_BASE}?lat=${lat}&lon=${lon}&api_key=${api_key}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`geocode.maps.co API error: ${response.status}`);

  const data = await response.json();
  const { house_number, road, suburb } = data.address;
  return `${house_number} ${road} ${suburb}`;
}
