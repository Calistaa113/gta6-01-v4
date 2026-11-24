// Game-wide constants: the city grid, palette, districts, cars, weapons, radio and cast.
export const CITY = {
  cols: 9,            // blocks from west to east
  rows: 7,            // blocks from north to south
  block: 64,          // side of one block, metres
  road: 16,           // road width, metres
  sidewalk: 3,
  beachDepth: 46,     // sand between the southern road and the sea
};
CITY.pitch = CITY.block + CITY.road;
CITY.width = CITY.cols * CITY.pitch + CITY.road;
CITY.depth = CITY.rows * CITY.pitch + CITY.road;
CITY.x0 = -CITY.width / 2;
CITY.z0 = -CITY.depth / 2;
CITY.shoreZ = CITY.z0 + CITY.depth + CITY.beachDepth;

export const PALETTE = {
  skyTop: 0x2a1f5c,
  skyMid: 0xd9628a,
  horizon: 0xffa25a,
  fog: 0xe8957e,
  sun: 0xffc488,
  sea: 0x1f5f86,
  sand: 0xe9c79a,
  asphalt: 0x3b3a44,
  sidewalk: 0xb7a9a0,
  lane: 0xf2e6c8,
  grass: 0x5f8f4e,
  neon: [0xff3d8b, 0x22e4ff, 0xffd23f, 0xa45bff, 0x46ff9a],
  carColors: [0xf4f1ea, 0x1d1d24, 0xd8302f, 0x2e7dd6, 0xf2b234, 0x37b39b, 0xe86bb0, 0x8c96a3, 0xff7a2f, 0x6b3fd1],
  buildings: [0xf3d8c0, 0xe8b9a5, 0xf6efe4, 0xd9e4ea, 0xc8d6cf, 0xf0c99a, 0xe0a6a0, 0xbfc9de, 0xf7e1b5, 0xd4b8e0],
};

// First match wins: column/row of a block decides its district.
export const DISTRICTS = [
  { id: 'heights', name: 'PALM HEIGHTS', test: (c) => c <= 1 },
  { id: 'port', name: 'PORT VARELA', test: (c) => c >= 7 },
  { id: 'strip', name: 'NEON STRIP', test: (c, r) => r >= 5 },
  { id: 'downtown', name: 'DOWNTOWN SOLANA', test: (c, r) => c >= 3 && c <= 5 && r <= 3 },
  { id: 'oldtown', name: 'CASCO VIEJO', test: () => true },
];

export const CAR_MODELS = [
  { id: 'ardent', name: 'ARDENT GT', len: 4.6, wid: 2.0, hgt: 1.1, top: 0.42, speed: 62, accel: 16, grip: 3.2, kind: 'sport' },
  { id: 'cabrio', name: 'MARISOL CABRIO', len: 4.4, wid: 1.95, hgt: 1.15, top: 0, speed: 54, accel: 13, grip: 3.0, kind: 'convertible' },
  { id: 'sedan', name: 'LUMA SEDAN', len: 4.8, wid: 2.0, hgt: 1.3, top: 0.6, speed: 46, accel: 10, grip: 2.6, kind: 'sedan' },
  { id: 'taxi', name: 'COSTA CAB', len: 4.8, wid: 2.0, hgt: 1.3, top: 0.6, speed: 44, accel: 10, grip: 2.6, kind: 'taxi' },
  { id: 'van', name: 'BREVA VAN', len: 5.4, wid: 2.2, hgt: 2.2, top: 0, speed: 36, accel: 7, grip: 2.2, kind: 'van' },
  { id: 'suv', name: 'TORO SUV', len: 5.0, wid: 2.2, hgt: 1.6, top: 0.7, speed: 44, accel: 10, grip: 2.4, kind: 'suv' },
  { id: 'police', name: 'VMPD INTERCEPTOR', len: 4.9, wid: 2.05, hgt: 1.3, top: 0.6, speed: 58, accel: 15, grip: 3.0, kind: 'police' },
];

export const WEAPONS = [
  { id: 'fists', name: 'FISTS', dmg: 18, rate: 0.45, range: 2.4, spread: 0, ammo: Infinity, pellets: 1, price: 0 },
  { id: 'pistol', name: 'VX-9 PISTOL', dmg: 26, rate: 0.28, range: 70, spread: 0.02, ammo: 60, pellets: 1, price: 400 },
  { id: 'smg', name: 'HORNET SMG', dmg: 15, rate: 0.08, range: 60, spread: 0.05, ammo: 180, pellets: 1, price: 1500 },
  { id: 'shotgun', name: 'BREAKER 12', dmg: 14, rate: 0.85, range: 26, spread: 0.12, ammo: 32, pellets: 7, price: 2600 },
];

export const RADIO = [
  { name: 'COASTLINE 98.4', bpm: 96, key: 57, mood: 'sunset' },
  { name: 'NEON DRIFT FM', bpm: 118, key: 50, mood: 'synth' },
  { name: 'PUERTO BEAT 104', bpm: 104, key: 55, mood: 'latin' },
  { name: 'RADIO OFF', bpm: 0, key: 0, mood: 'off' },
];

export const RANKS = ['Nobody', 'Street Rat', 'Runner', 'Fixer', 'Shot Caller', 'Coast Legend'];

export const STORY_CAST = {
  ness: 'Ness',
  teo: 'Teo',
  marr: 'Silvio Marr',
  kroll: 'Commissioner Kroll',
  lupe: 'Lupe',
};
