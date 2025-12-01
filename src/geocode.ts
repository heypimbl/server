import options from "./options";

export const reverseGeocode = options.mapscoApiKey ? reverseGeocodeMapsco : reverseGeocodeGeoNames;

export async function reverseGeocodeMapsco(latitude: number, longitude: number) {
  if (!options.mapscoApiKey) throw new Error("PIMBL_MAPSCO_API_KEY not defined");

  const url = new URL("https://geocode.maps.co/reverse");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("api_key", options.mapscoApiKey);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url.host} API error: ${response.status}`);

  const data = await response.json();
  const { house_number, road, suburb } = data.address;
  return `${house_number} ${road} ${suburb}`;
}

export async function reverseGeocodeGeoNames(latitude: number, longitude: number) {
  const url = new URL("http://api.geonames.org/findNearestIntersectionJSON");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lng", String(longitude));
  url.searchParams.set("username", "pimbl");

  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url.host} API error: ${response.status}`);

  const data = await response.json();
  const { street1, street2, adminName2 } = data.intersection;

  let borough = adminName2 as string;
  if (borough === "Kings") {
    borough = "Brooklyn";
  } else if (borough === "Richmond") {
    borough = "Staten Island";
  }

  return `${street1} and ${street2}, ${borough}`;
}
