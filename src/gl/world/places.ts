/**
 * The world is Earth, seen over the Middle East at night (docs/STORY.md fig. 8). Pure data, no imports: ./layout.ts
 * maps these onto the planet and scripts/bake-earth.mjs reads them too (Node strips the types), to check that every
 * city stands on land in the baked map (public/data/earth.png).
 *
 * Coordinates are real (degrees, north and east positive). `w` is a population-like weight (roughly the metro's size,
 * and how much light it gives off at night), which sets each city's light. The first is the hub: Riyadh, where your
 * point lands and becomes the first city; the others light outward from it in order of distance.
 *
 * PLACES are the region's cities: the brightest and densest lights, wired into the network, the ones the flock rises
 * from. FAR_PLACES are the world beyond it on the night side that figs 8-9 see (Africa, Europe, Asia out to the
 * eastern limb): smaller, softer lights, most of them dim, lit last as your point's light spreads on round the world.
 * Only places those cameras actually see are listed. The far lights are wired too, region by region (FAR_WEBS), and
 * joined to the region through their real gateways (FAR_GATES), so the whole network grows out of Riyadh.
 */
export type Place = { name: string; lat: number; lon: number; w: number; hub?: true };

/** Riyadh: the hub (./layout.ts HUB). */
export const HUB_GEO = { lat: 24.7136, lon: 46.6753 };

export const PLACES: Place[] = [
  { name: "riyadh", lat: 24.7136, lon: 46.6753, w: 1.25 },
  // the kingdom
  { name: "jeddah", lat: 21.5292, lon: 39.2179, w: 0.78, hub: true },
  { name: "mecca", lat: 21.4225, lon: 39.8262, w: 0.58 },
  { name: "medina", lat: 24.4672, lon: 39.6111, w: 0.55 },
  { name: "dammam", lat: 26.392, lon: 50.0, w: 0.66 },
  { name: "al-ahsa", lat: 25.3833, lon: 49.5864, w: 0.42 },
  { name: "buraidah", lat: 26.3592, lon: 43.9818, w: 0.42 },
  { name: "hail", lat: 27.5114, lon: 41.7208, w: 0.34 },
  { name: "tabuk", lat: 28.3838, lon: 36.555, w: 0.38 },
  { name: "abha", lat: 18.2164, lon: 42.5053, w: 0.42 },
  { name: "taif", lat: 21.2703, lon: 40.4158, w: 0.4 },
  { name: "jazan", lat: 16.95, lon: 42.68, w: 0.32 },
  { name: "neom", lat: 28.05, lon: 35.4, w: 0.24 },
  // the gulf
  { name: "kuwait city", lat: 29.3, lon: 47.92, w: 0.66 },
  { name: "manama", lat: 26.12, lon: 50.55, w: 0.44 },
  { name: "doha", lat: 25.2854, lon: 51.49, w: 0.6 },
  { name: "abu dhabi", lat: 24.38, lon: 54.52, w: 0.6 },
  { name: "dubai", lat: 25.12, lon: 55.36, w: 0.76, hub: true },
  { name: "muscat", lat: 23.58, lon: 58.35, w: 0.5 },
  // yemen
  { name: "sana'a", lat: 15.3694, lon: 44.191, w: 0.46, hub: true },
  { name: "aden", lat: 12.88, lon: 44.98, w: 0.38 },
  // the levant
  { name: "amman", lat: 31.9454, lon: 35.9284, w: 0.6 },
  { name: "jerusalem", lat: 31.7683, lon: 35.2137, w: 0.52 },
  { name: "beirut", lat: 33.86, lon: 35.57, w: 0.54 },
  { name: "damascus", lat: 33.5138, lon: 36.2765, w: 0.55 },
  { name: "aleppo", lat: 36.2021, lon: 37.1343, w: 0.45 },
  // mesopotamia and iran
  { name: "baghdad", lat: 33.3152, lon: 44.3661, w: 0.8, hub: true },
  { name: "basra", lat: 30.5085, lon: 47.7804, w: 0.5 },
  { name: "tehran", lat: 35.6892, lon: 51.389, w: 0.95 },
  { name: "isfahan", lat: 32.6546, lon: 51.668, w: 0.56 },
  { name: "shiraz", lat: 29.5918, lon: 52.5837, w: 0.5 },
  // egypt, sudan and the horn
  { name: "cairo", lat: 30.0444, lon: 31.2357, w: 1.0, hub: true },
  { name: "alexandria", lat: 31.14, lon: 29.98, w: 0.68 },
  { name: "khartoum", lat: 15.5007, lon: 32.5599, w: 0.62 },
  { name: "port sudan", lat: 19.6, lon: 37.18, w: 0.3 },
  { name: "addis ababa", lat: 9.03, lon: 38.74, w: 0.62 },
  { name: "djibouti", lat: 11.54, lon: 43.06, w: 0.34 },
  // anatolia, and east to the indus
  { name: "istanbul", lat: 41.05, lon: 28.9, w: 0.95 },
  { name: "ankara", lat: 39.9334, lon: 32.8597, w: 0.68 },
  { name: "karachi", lat: 24.8607, lon: 67.0511, w: 0.86 },
];

/** Beyond the region: the night side as the world (lighter weights than the region's, so the region still leads). */
export const FAR_PLACES: Place[] = [
  // africa: the maghreb, the west african coast and nigeria, the congo, the great lakes and the east, the highveld
  { name: "tripoli", lat: 32.84, lon: 13.18, w: 0.26 },
  { name: "tunis", lat: 36.8065, lon: 10.1815, w: 0.26 },
  { name: "algiers", lat: 36.7538, lon: 3.0588, w: 0.3 },
  { name: "casablanca", lat: 33.5731, lon: -7.5898, w: 0.3 },
  { name: "lagos", lat: 6.6018, lon: 3.3515, w: 0.34 },
  { name: "abuja", lat: 9.0765, lon: 7.3986, w: 0.2 },
  { name: "accra", lat: 5.6037, lon: -0.187, w: 0.22 },
  { name: "abidjan", lat: 5.36, lon: -4.0083, w: 0.22 },
  { name: "kinshasa", lat: -4.4419, lon: 15.2663, w: 0.22 },
  { name: "luanda", lat: -8.839, lon: 13.2894, w: 0.22 },
  { name: "kampala", lat: 0.3476, lon: 32.5825, w: 0.18 },
  { name: "nairobi", lat: -1.2921, lon: 36.8219, w: 0.26 },
  { name: "dar es salaam", lat: -6.7924, lon: 39.2083, w: 0.22 },
  { name: "johannesburg", lat: -26.2041, lon: 28.0473, w: 0.38 },
  // europe
  { name: "london", lat: 51.5074, lon: -0.1278, w: 0.44 },
  { name: "paris", lat: 48.8566, lon: 2.3522, w: 0.44 },
  { name: "madrid", lat: 40.4168, lon: -3.7038, w: 0.36 },
  { name: "barcelona", lat: 41.3874, lon: 2.1686, w: 0.28 },
  { name: "lisbon", lat: 38.78, lon: -9.17, w: 0.24 },
  { name: "rome", lat: 41.9028, lon: 12.4964, w: 0.32 },
  { name: "milan", lat: 45.4642, lon: 9.19, w: 0.34 },
  { name: "munich", lat: 48.1351, lon: 11.582, w: 0.24 },
  { name: "berlin", lat: 52.52, lon: 13.405, w: 0.32 },
  { name: "amsterdam", lat: 52.3676, lon: 4.9041, w: 0.26 },
  { name: "vienna", lat: 48.2082, lon: 16.3738, w: 0.26 },
  { name: "budapest", lat: 47.4979, lon: 19.0402, w: 0.24 },
  { name: "warsaw", lat: 52.2297, lon: 21.0122, w: 0.26 },
  { name: "athens", lat: 37.9838, lon: 23.7275, w: 0.3 },
  { name: "bucharest", lat: 44.4268, lon: 26.1025, w: 0.26 },
  { name: "kyiv", lat: 50.4501, lon: 30.5234, w: 0.3 },
  { name: "moscow", lat: 55.7558, lon: 37.6173, w: 0.46 },
  { name: "st petersburg", lat: 59.9311, lon: 30.3609, w: 0.28 },
  // the caucasus and central asia
  { name: "tbilisi", lat: 41.7151, lon: 44.8271, w: 0.2 },
  { name: "yerevan", lat: 40.1792, lon: 44.4991, w: 0.2 },
  { name: "baku", lat: 40.4093, lon: 49.8671, w: 0.28 },
  { name: "tashkent", lat: 41.2995, lon: 69.2401, w: 0.3 },
  { name: "almaty", lat: 43.222, lon: 76.8512, w: 0.24 },
  { name: "kabul", lat: 34.5553, lon: 69.2075, w: 0.2 },
  // south asia
  { name: "islamabad", lat: 33.6844, lon: 73.0479, w: 0.22 },
  { name: "lahore", lat: 31.5204, lon: 74.3587, w: 0.38 },
  { name: "delhi", lat: 28.7041, lon: 77.1025, w: 0.5 },
  { name: "jaipur", lat: 26.9124, lon: 75.7873, w: 0.22 },
  { name: "ahmedabad", lat: 23.0225, lon: 72.5714, w: 0.3 },
  { name: "mumbai", lat: 19.076, lon: 72.8777, w: 0.46 },
  { name: "pune", lat: 18.5204, lon: 73.8567, w: 0.26 },
  { name: "hyderabad", lat: 17.385, lon: 78.4867, w: 0.34 },
  { name: "bengaluru", lat: 12.9716, lon: 77.5946, w: 0.36 },
  { name: "chennai", lat: 13.0827, lon: 80.2707, w: 0.32 },
  { name: "kolkata", lat: 22.5726, lon: 88.3639, w: 0.4 },
  { name: "dhaka", lat: 23.8103, lon: 90.4125, w: 0.38 },
  // east and south-east asia, as far as the eastern limb shows
  { name: "bangkok", lat: 13.7563, lon: 100.5018, w: 0.36 },
  { name: "kuala lumpur", lat: 3.139, lon: 101.6869, w: 0.3 },
  { name: "jakarta", lat: -6.2088, lon: 106.8456, w: 0.34 },
  { name: "chengdu", lat: 30.5728, lon: 104.0668, w: 0.3 },
  { name: "beijing", lat: 39.9042, lon: 116.4074, w: 0.42 },
  { name: "shanghai", lat: 31.2304, lon: 121.4737, w: 0.44 },
  { name: "guangzhou", lat: 23.1291, lon: 113.2644, w: 0.4 },
  // africa again, the heart of it: the cities the continent's network runs through (Yaounde between the Gulf of Guinea
  // and the Congo, the Copperbelt, the Zambezi), so it is a web as the region's is, never long strands across empty
  // land. (Listed last so every light above keeps its seed: its switch-on moment and its towns are unchanged.)
  { name: "yaounde", lat: 3.848, lon: 11.5021, w: 0.24 },
  { name: "lubumbashi", lat: -11.6647, lon: 27.4794, w: 0.2 },
  { name: "lusaka", lat: -15.3875, lon: 28.3228, w: 0.24 },
  { name: "harare", lat: -17.8292, lon: 31.0522, w: 0.22 },
];

/**
 * The far network (./layout.ts FAR_ARCS): each web wires its own cities to their near neighbours (a spanning tree of
 * the shortest links, then a few more that close loops, never across another link), so each region reads as a web
 * of its own, as the Middle East's does.
 */
export const FAR_WEBS: string[][] = [
  // north africa, along the coast
  ["tripoli", "tunis", "algiers", "casablanca"],
  // west africa, to Cameroon
  ["lagos", "abuja", "accra", "abidjan", "yaounde"],
  // east, central and southern africa
  [
    "kampala",
    "nairobi",
    "dar es salaam",
    "kinshasa",
    "luanda",
    "lubumbashi",
    "lusaka",
    "harare",
    "johannesburg",
  ],
  // europe
  [
    "athens",
    "bucharest",
    "budapest",
    "vienna",
    "rome",
    "milan",
    "munich",
    "berlin",
    "warsaw",
    "kyiv",
    "moscow",
    "st petersburg",
    "amsterdam",
    "paris",
    "london",
    "madrid",
    "barcelona",
    "lisbon",
  ],
  // the caucasus and central asia
  ["baku", "tbilisi", "yerevan", "tashkent", "almaty", "kabul"],
  // south asia
  [
    "islamabad",
    "lahore",
    "delhi",
    "jaipur",
    "ahmedabad",
    "mumbai",
    "pune",
    "hyderabad",
    "bengaluru",
    "chennai",
    "kolkata",
    "dhaka",
  ],
  // east and south-east asia, to the limb
  ["bangkok", "kuala lumpur", "jakarta", "chengdu", "guangzhou", "shanghai", "beijing"],
];

/**
 * The gateways: trunks from a city of the region out to a web (Istanbul to the Balkans, Alexandria along the coast,
 * Khartoum and Addis Ababa south, Karachi to India, Tehran to the Caucasus), then the bridges between webs (round the
 * Mediterranean, over the Congo to Cameroon, through the Khyber, over the Bay of Bengal).
 */
export const FAR_GATES: [string, string][] = [
  ["istanbul", "athens"],
  ["istanbul", "bucharest"],
  ["alexandria", "tripoli"],
  ["khartoum", "kampala"],
  ["addis ababa", "nairobi"],
  ["karachi", "ahmedabad"],
  ["karachi", "lahore"],
  ["tehran", "baku"],
  // bridges
  ["tunis", "rome"],
  ["casablanca", "lisbon"],
  ["kinshasa", "yaounde"],
  ["islamabad", "kabul"],
  ["dhaka", "bangkok"],
  ["dhaka", "chengdu"],
];
