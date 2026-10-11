'use strict';

// ---------------------------------------------------------------------------
// Bengaluru mode: the map.
//
// A pocket-sized Bengaluru laid out after the real city (north is up):
// Malleswaram and Sankey Tank in the north-west, Bangalore Palace north of
// Vidhana Soudha, the Race Course between Majestic and Vidhana Soudha, Cubbon
// Park with the High Court and Chinnaswamy Stadium beside it, MG Road and
// Brigade Road to the east with Ulsoor Lake and Indiranagar beyond, K.R.
// Market and the old fort south of Majestic, Lalbagh further south with
// Basavanagudi to its west and Jayanagar below it, Koramangala and Silk Board
// in the south-east, Rajajinagar (ISKCON, the World Trade Center, Orion
// Mall) and Vijayanagar out west. Distances are squeezed so the landmarks fit.
// ---------------------------------------------------------------------------
const BW = 4800, BH = 3600;                 // city size in world pixels
const RAIL_Y = 1060;                        // the railway into KSR Bengaluru City

const B_ROADS = [
  // East-west.
  { name: 'Sankey Road', x: 840, y: 746, w: 3960, h: 28 },
  { name: 'Kempegowda Road', x: 840, y: 1386, w: 1210, h: 28 },
  { name: 'Dr. Ambedkar Veedhi', x: 2050, y: 1386, w: 984, h: 28 },
  { name: 'MG Road', x: 3006, y: 1886, w: 1794, h: 28 },
  { name: 'J.C. Road', x: 840, y: 2286, w: 2180, h: 28 },
  { name: 'Richmond Road', x: 3020, y: 2286, w: 1780, h: 28 },
  { name: 'R.V. Road', x: 840, y: 3046, w: 2180, h: 28 },
  { name: 'Outer Ring Road', x: 3006, y: 3436, w: 1794, h: 28 },
  // North-south.
  { name: 'Sampige Road', x: 1486, y: 0, w: 28, h: 1386 },
  { name: 'Avenue Road', x: 1486, y: 1414, w: 28, h: 872 },
  { name: 'K.R. Road', x: 1486, y: 2314, w: 28, h: 1286 },
  { name: 'Palace Road', x: 2036, y: 0, w: 28, h: 746 },
  { name: 'Race Course Road', x: 2036, y: 774, w: 28, h: 612 },
  { name: 'Nrupathunga Road', x: 2036, y: 1414, w: 28, h: 872 },
  { name: 'South End Road', x: 2036, y: 3074, w: 28, h: 526 },
  { name: 'Queens Road', x: 3006, y: 774, w: 28, h: 612 },
  { name: 'Kasturba Road', x: 3006, y: 1414, w: 28, h: 872 },
  { name: 'Hosur Road', x: 3006, y: 2314, w: 28, h: 1286 },
  // Smaller streets.
  { name: '8th Cross, Malleswaram', x: 840, y: 370, w: 646, h: 20, small: true },
  { name: 'Commercial Street', x: 3034, y: 400, w: 700, h: 20, small: true },
  { name: '100 Feet Road, Indiranagar', x: 4400, y: 774, w: 20, h: 1112, small: true },
  { name: 'Brigade Road', x: 3590, y: 1914, w: 20, h: 372, small: true },
  { name: 'Church Street', x: 3034, y: 2090, w: 556, h: 20, small: true },
  { name: 'Chickpet Main Road', x: 840, y: 1900, w: 646, h: 20, small: true },
  { name: 'Gandhi Bazaar Main Road', x: 840, y: 2930, w: 646, h: 20, small: true },
  { name: 'Bull Temple Road', x: 1100, y: 3074, w: 20, h: 526, small: true },
  { name: '11th Main, Jayanagar', x: 2064, y: 3250, w: 942, h: 20, small: true },
  { name: '30th Cross, Jayanagar', x: 1514, y: 3420, w: 1492, h: 20, small: true },
  { name: '9th Main, Jayanagar', x: 2540, y: 3074, w: 20, h: 526, small: true },
  { name: '80 Feet Road, Koramangala', x: 3034, y: 2800, w: 1766, h: 20, small: true },
  // Out west: Rajajinagar and Vijayanagar.
  { name: 'Magadi Road', x: 0, y: 1386, w: 840, h: 28 },
  { name: 'Rajajinagar Main Road', x: 0, y: 186, w: 1486, h: 28 },
  { name: 'Dr. Rajkumar Road', x: 300, y: 214, w: 28, h: 1172 },
  { name: 'West of Chord Road', x: 640, y: 214, w: 28, h: 1172 },
  { name: 'Chord Road', x: 640, y: 1414, w: 28, h: 2186 },
  { name: 'Vijayanagar Main Road', x: 0, y: 2186, w: 640, h: 20, small: true },
];

const B_DISTRICTS = [
  { name: 'Rajajinagar', x: 0, y: 0, w: 840, h: 1386, ground: '#c4b8a2', mus: 'city' },
  { name: 'Vijayanagar', x: 0, y: 1414, w: 840, h: 2186, ground: '#cfc5b0', mus: 'city' },
  { name: 'Malleswaram', x: 840, y: 0, w: 646, h: 746, ground: '#b9b08a', mus: 'city' },
  { name: 'Sankey Tank', x: 1514, y: 0, w: 522, h: 746, ground: '#74a34a', mus: 'city' },
  { name: 'Bangalore Palace', x: 2064, y: 0, w: 942, h: 746, ground: '#7fae54', mus: 'city' },
  { name: 'Commercial Street', x: 3034, y: 0, w: 700, h: 746, ground: '#c4b8a2', mus: 'city' },
  { name: 'Ulsoor', x: 3734, y: 0, w: 1066, h: 746, ground: '#74a34a', mus: 'city' },
  { name: 'Majestic', x: 840, y: 774, w: 646, h: 1512, ground: '#c2b8a4', mus: 'city' },
  { name: 'Race Course', x: 1514, y: 774, w: 522, h: 612, ground: '#77a34c', mus: 'city' },
  { name: 'Vidhana Soudha', x: 2064, y: 774, w: 942, h: 612, ground: '#7fae54', mus: 'city' },
  { name: 'Chinnaswamy', x: 3034, y: 774, w: 1366, h: 1112, ground: '#77a34c', mus: 'city' },
  { name: 'Indiranagar', x: 4400, y: 774, w: 400, h: 1112, ground: '#c4b8a2', mus: 'city' },
  { name: 'Freedom Park', x: 1514, y: 1414, w: 522, h: 872, ground: '#77a34c', mus: 'city' },
  { name: 'Cubbon Park', x: 2064, y: 1414, w: 942, h: 872, ground: '#659843', mus: 'city' },
  { name: 'MG Road', x: 3034, y: 1914, w: 1766, h: 372, ground: '#c4b8a2', mus: 'city' },
  { name: 'K.R. Market', x: 840, y: 2314, w: 646, h: 600, ground: '#c2b8a4', mus: 'city' },
  { name: 'Basavanagudi', x: 840, y: 2914, w: 646, h: 686, ground: '#b9b08a', mus: 'city' },
  { name: 'Lalbagh', x: 1514, y: 2314, w: 1492, h: 732, ground: '#70a548', mus: 'city' },
  { name: 'Jayanagar', x: 1514, y: 3074, w: 1492, h: 526, ground: '#cfc5b0', mus: 'city' },
  { name: 'Koramangala', x: 3034, y: 2314, w: 1766, h: 1286, ground: '#c4b8a2', mus: 'city' },
];

const B_LAKES = [
  { name: 'Sankey Tank', x: 1775, y: 390, rx: 200, ry: 110 },
  { name: 'Ulsoor Lake', x: 4250, y: 410, rx: 400, ry: 210, islands: [{ x: 4140, y: 390, rx: 44, ry: 24 }, { x: 4400, y: 470, rx: 32, ry: 18 }] },
  { name: 'Lalbagh Lake', x: 2650, y: 2840, rx: 200, ry: 80 },
];
const B_STADIUM = { x: 3300, y: 1300, rx: 220, ry: 130, irx: 150, iry: 82 };
const B_TRACK = { x: 1775, y: 1110, rx: 235, ry: 160, w: 22 };
const B_CIRCLES = [{ name: 'South End Circle', x: 2050, y: 3060, r: 46, garden: 18 }];
const B_CLOCK = { x: 2140, y: 2400, r: 24 };          // Lalbagh's flower clock
const B_JAM = { x: 2850, y: 3300, w: 700, h: 300 };   // Silk Board, where traffic crawls

// Namma Metro lines as polylines, with stations on them, following the real
// routes: Purple east-west along MG Road, Green north-south through Majestic,
// Yellow from R.V. Road past Silk Board.
const B_LINES = {
  purple: {
    name: 'Purple Line', col: '#8a4fb8', dark: '#5b2f80', light: '#c9a3e6',
    pts: [[60, 1400], [3020, 1400], [3020, 1900], [4760, 1900]],
    stations: [
      { id: 'mysoreroad', name: 'Mysore Road', x: 110, y: 1400 },
      { id: 'deepanjali', name: 'Deepanjali Nagar', x: 270, y: 1400 },
      { id: 'attiguppe', name: 'Attiguppe', x: 430, y: 1400 },
      { id: 'vijayanagar', name: 'Vijayanagar', x: 590, y: 1400 },
      { id: 'hosahalli', name: 'Hosahalli', x: 760, y: 1400 },
      { id: 'magadi', name: 'Magadi Road', x: 950, y: 1400 },
      { id: 'cityrail', name: 'City Railway Station', x: 1240, y: 1400 },
      { id: 'majestic', name: 'Majestic', x: 1500, y: 1400 },
      { id: 'visvesvaraya', name: 'Sir M. Visvesvaraya', x: 1880, y: 1400 },
      { id: 'vidhana', name: 'Vidhana Soudha', x: 2540, y: 1400 },
      { id: 'cubbon', name: 'Cubbon Park', x: 3020, y: 1650 },
      { id: 'mgroad', name: 'MG Road', x: 3540, y: 1900 },
      { id: 'trinity', name: 'Trinity', x: 3940, y: 1900 },
      { id: 'halasuru', name: 'Halasuru', x: 4280, y: 1900 },
      { id: 'indiranagar', name: 'Indiranagar', x: 4640, y: 1900 },
    ],
  },
  green: {
    name: 'Green Line', col: '#3fa34d', dark: '#24702f', light: '#9fdc8f',
    pts: [[300, 200], [1500, 200], [1500, 3060], [2050, 3060], [2050, 3440]],
    stations: [
      { id: 'yeshwanthpur', name: 'Yeshwanthpur', x: 340, y: 200 },
      { id: 'sandalsoap', name: 'Sandal Soap Factory', x: 530, y: 200 },
      { id: 'mahalakshmi', name: 'Mahalakshmi', x: 740, y: 200 },
      { id: 'rajajinagar', name: 'Rajajinagar', x: 950, y: 200 },
      { id: 'kuvempu', name: 'Kuvempu Road', x: 1150, y: 200 },
      { id: 'srirampura', name: 'Srirampura', x: 1350, y: 200 },
      { id: 'sampige', name: 'Sampige Road', x: 1500, y: 520 },
      { id: 'majestic', name: 'Majestic', x: 1500, y: 1400 },
      { id: 'chickpete', name: 'Chickpete', x: 1500, y: 1860 },
      { id: 'krmarket', name: 'K.R. Market', x: 1500, y: 2380 },
      { id: 'national', name: 'National College', x: 1500, y: 2780 },
      { id: 'lalbagh', name: 'Lalbagh', x: 1760, y: 3060 },
      { id: 'southend', name: 'South End Circle', x: 2050, y: 3150 },
      { id: 'jayanagar', name: 'Jayanagar', x: 2050, y: 3300 },
      { id: 'rvroad', name: 'R.V. Road', x: 2050, y: 3440 },
    ],
  },
  yellow: {
    name: 'Yellow Line', col: '#e3b21f', dark: '#9c7a12', light: '#ffe27a',
    pts: [[2050, 3440], [4760, 3440]],
    stations: [
      { id: 'rvroad', name: 'R.V. Road', x: 2050, y: 3440 },
      { id: 'ragigudda', name: 'Ragigudda', x: 2330, y: 3440 },
      { id: 'jayadeva', name: 'Jayadeva Hospital', x: 2620, y: 3440 },
      { id: 'btm', name: 'BTM Layout', x: 2860, y: 3440 },
      { id: 'silkboard', name: 'Central Silk Board', x: 3140, y: 3440 },
      { id: 'bommanahalli', name: 'Bommanahalli', x: 3740, y: 3440 },
      { id: 'hongasandra', name: 'Hongasandra', x: 4340, y: 3440 },
    ],
  },
};
// Stations shared by two lines, and where you come down to the street there.
const B_INTERCHANGES = { majestic: { x: 1528, y: 1430 }, rvroad: { x: 2078, y: 3470 } };

// Trains pull into KSR Bengaluru City from the west.
const B_TRAIN_STOP = 1240;

// Postcards: one per landmark. Facts are kept short and true.
const B_POSTCARDS = [
  { id: 'vidhana', name: 'Vidhana Soudha', x: 2640, y: 1384, r: 70, fact: "Karnataka's legislature, finished in 1956 in Bangalore granite. Over the door: Government's Work is God's Work." },
  { id: 'highcourt', name: 'Karnataka High Court', x: 2330, y: 1580, r: 60, fact: 'Attara Kacheri, the "eighteen offices". The red building (1868) faces Vidhana Soudha.' },
  { id: 'palace', name: 'Bangalore Palace', x: 2535, y: 616, r: 80, fact: "The Wodeyars' palace, built in Tudor style and said to be modelled on Windsor Castle." },
  { id: 'cubbon', name: 'Cubbon Park', x: 2450, y: 1976, r: 60, fact: 'Laid out in 1870. Its official name is Sri Chamarajendra Park. Morning walkers: countless.' },
  { id: 'library', name: 'State Central Library', x: 2700, y: 1894, r: 50, fact: 'Seshadri Iyer Memorial Hall, the red building in Cubbon Park, holds the State Central Library.' },
  { id: 'museum', name: 'Visvesvaraya Museum', x: 2880, y: 1714, r: 50, fact: "Named after Sir M. Visvesvaraya, the engineer whose birthday is India's Engineers' Day." },
  { id: 'stadium', name: 'Chinnaswamy Stadium', x: 3300, y: 1300, r: 80, fact: 'Test cricket here since 1974, and home of RCB. Ee sala cup namde!' },
  { id: 'stmarks', name: "St. Mark's Cathedral", x: 3720, y: 1878, r: 50, fact: "One of the city's oldest churches, consecrated in 1816 at the top of MG Road." },
  { id: 'brigade', name: 'Brigade Road', x: 3600, y: 2100, r: 60, fact: 'Shops, music and crowds every weekend, just off MG Road.' },
  { id: 'ubcity', name: 'UB City', x: 3260, y: 2286, r: 60, fact: 'Glass towers and a luxury mall on Vittal Mallya Road.' },
  { id: 'commercial', name: 'Commercial Street', x: 3380, y: 410, r: 70, fact: 'Bangles, fabric and bargains, in a lane that is always busy.' },
  { id: 'ulsoor', name: 'Ulsoor Lake', x: 4250, y: 650, r: 80, fact: "A lake from Kempegowda's time, with small islands to row around." },
  { id: 'indiranagar', name: '100 Feet Road', x: 4410, y: 1300, r: 60, fact: 'Indiranagar: cafes, pubs and very good coffee.' },
  { id: 'racecourse', name: 'Bangalore Race Course', x: 1775, y: 936, r: 80, fact: 'The Bangalore Turf Club has raced horses here for about a century.' },
  { id: 'holidayinn', name: 'Holiday Inn, Race Course Rd', x: 2150, y: 1384, r: 46, fact: 'A hotel with the racetrack for a neighbour. Room service comes with hoofbeats.' },
  { id: 'sankey', name: 'Sankey Tank', x: 1775, y: 520, r: 70, fact: 'A lake made in 1882 by Colonel Richard Sankey to bring water to the city.' },
  { id: 'malleswaram', name: 'Kadu Malleshwara Temple', x: 1000, y: 316, r: 50, fact: 'A 17th-century Shiva temple that gave Malleswaram its name.' },
  { id: 'ksr', name: 'KSR Bengaluru City', x: 1240, y: 1384, r: 60, fact: "Krantivira Sangolli Rayanna station, the city's main railway terminus." },
  { id: 'busstand', name: 'Kempegowda Bus Station', x: 1160, y: 1716, r: 60, fact: 'Majestic: buses to everywhere, all leaving at once.' },
  { id: 'freedompark', name: 'Freedom Park', x: 1775, y: 1736, r: 60, fact: 'Once the Central Jail, now a park for concerts and protests.' },
  { id: 'townhall', name: 'Town Hall', x: 1775, y: 2280, r: 50, fact: 'Sir Puttanchetty Town Hall (1935), with its tall columns and wide steps.' },
  { id: 'krmarket', name: 'K.R. Market', x: 1000, y: 2486, r: 60, fact: 'City Market, built in 1928: flowers, fruit and plenty of noise.' },
  { id: 'fort', name: 'Bangalore Fort', x: 1330, y: 2496, r: 50, fact: 'Kempegowda built it in mud in 1537; Hyder Ali rebuilt it in stone. The Delhi Gate still stands.' },
  { id: 'tipu', name: "Tipu Sultan's Summer Palace", x: 1160, y: 2806, r: 60, fact: 'Finished in 1791 and built almost entirely of teak.' },
  { id: 'bulltemple', name: 'Bull Temple', x: 990, y: 3316, r: 60, fact: 'Dodda Basavana Gudi: a granite Nandi about 4.6 metres tall, from the 1500s.' },
  { id: 'buglerock', name: 'Bugle Rock', x: 1320, y: 3346, r: 60, fact: 'A Kempegowda watchtower stands on this rock in Basavanagudi.' },
  { id: 'vidyarthi', name: 'Vidyarthi Bhavan', x: 1000, y: 2960, r: 40, fact: 'Crisp masala dosas in Gandhi Bazaar since 1943.' },
  { id: 'glasshouse', name: 'Lalbagh Glass House', x: 2250, y: 2638, r: 70, fact: "Built in 1889, inspired by London's Crystal Palace. Flower shows every January and August." },
  { id: 'rock', name: 'Lalbagh Rock', x: 1800, y: 2914, r: 60, fact: 'Some of the oldest rock on Earth, about 3,000 million years old, with a Kempegowda tower on top.' },
  { id: 'mtr', name: 'MTR, Lalbagh Road', x: 1970, y: 2296, r: 40, fact: 'Mavalli Tiffin Rooms, serving since 1924. Rava idli was invented here when rice ran short in the war.' },
  { id: 'jayanagar', name: 'Jayanagar Blossom Avenue', x: 2300, y: 3260, r: 70, fact: 'Planned in 1948. When the pink tabebuias bloom, Bengaluru calls it cherry blossom season.' },
  { id: 'koramangala', name: 'Koramangala', x: 3600, y: 2810, r: 70, fact: 'Start-up offices, late-night cafes and a lot of laptops.' },
  { id: 'silkboard', name: 'Silk Board Junction', x: 3020, y: 3450, r: 70, fact: 'Famous for its traffic. Pack snacks.' },
  { id: 'iskcon', name: 'ISKCON Temple', x: 740, y: 618, r: 70, fact: 'The Hare Krishna temple on a hill in Rajajinagar, opened in 1997, with a gold-glass tower.' },
  { id: 'wtc', name: 'World Trade Center', x: 180, y: 640, r: 50, fact: 'WTC Bengaluru at Brigade Gateway, one of the tallest towers in the city.' },
  { id: 'orion', name: 'Orion Mall', x: 480, y: 660, r: 50, fact: 'A big mall at Brigade Gateway in Rajajinagar, with a lake out the back.' },
  { id: 'anjaneya', name: 'Gali Anjaneya Temple', x: 160, y: 1578, r: 50, fact: 'An old Hanuman temple on Mysore Road, by the Vrishabhavathi river.' },
  { id: 'kingfisher', name: 'Kingfisher Towers', x: 3090, y: 2096, r: 50, fact: 'Luxury towers on Kasturba Road, with a white mansion of a penthouse on the roof.' },
  { id: 'hardrock', name: 'Hard Rock Cafe', x: 3850, y: 2098, r: 45, fact: "On St. Mark's Road, a short walk from MG Road. Guitars on the walls, music all night." },
  { id: 'metro', name: 'Namma Metro', ride: true, x: 2540, y: 1428, fact: 'Opened in 2011. Purple runs east to west, Green north to south, and the Yellow Line (2025) out past Silk Board.' },
];

// Buildings: centre x, base y, footprint (fw x fd), minimap colour, and signs
// drawn on the sharp UI layer (x, y relative to the sprite's top-left).
const B_BUILDINGS = [
  // North.
  { spr: 'malleshwara', icon: true, x: 1000, y: 300, fw: 90, fd: 36, mcol: '#e8dcc0' },
  { spr: 'palace', icon: true, x: 2535, y: 600, fw: 320, fd: 60, mcol: '#d8cfbd', signs: [] },
  { spr: 'gurudwara', icon: true, x: 4250, y: 730, fw: 70, fd: 24, mcol: '#f2efe6' },
  // Race Course, Vidhana Soudha, Majestic.
  { spr: 'grandstand', icon: true, x: 1775, y: 925, fw: 216, fd: 30, mcol: '#e9e2d4', signs: [{ x: 110, y: 43, text: 'BANGALORE TURF CLUB', size: 3.6, color: '#ffffff' }] },
  { spr: 'holidayinn', icon: true, x: 2150, y: 1370, fw: 96, fd: 46, mcol: '#e9dfcc', signs: [{ x: 55, y: 26, text: 'HOLIDAY INN', size: 4.4, color: '#ffffff' }] },
  { spr: 'vidhana', icon: true, x: 2640, y: 1370, fw: 356, fd: 60, mcol: '#efe6d2', signs: [{ anchor: 'inscription', text: "GOVERNMENT'S WORK IS GOD'S WORK", size: 3, color: '#3a2a1a', outline: null }] },
  { spr: 'ksrcanopy', x: 1240, y: 1100, fw: 0, fd: 0, mcol: null },
  { spr: 'ksr', icon: true, x: 1240, y: 1370, fw: 290, fd: 60, mcol: '#efe2c0', signs: [{ x: 150, y: 46.5, text: 'KSR BENGALURU CITY', size: 4, color: '#ffffff' }] },
  { spr: 'busstand', x: 1160, y: 1700, fw: 270, fd: 50, mcol: '#c9c2b6', signs: [{ x: 140, y: 6.5, text: 'KEMPEGOWDA BUS STATION', size: 3.8, color: '#ffffff' }] },
  { spr: 'cinema', x: 960, y: 1880, fw: 100, fd: 40, mcol: '#d8433b', signs: [{ x: 55, y: 9, text: 'CINEMA', size: 5, color: '#ffe7a8' }] },
  { spr: 'freedom', icon: true, x: 1775, y: 1720, fw: 200, fd: 50, mcol: '#a89a80', signs: [{ x: 105, y: 62, text: 'FREEDOM PARK', size: 3.6, color: '#ffffff' }] },
  { spr: 'townhall', icon: true, x: 1760, y: 2270, fw: 160, fd: 50, mcol: '#ece6d8', signs: [{ x: 85, y: 21, text: 'TOWN HALL', size: 3.6, color: '#3a3530', outline: null }] },
  // Cubbon Park and around.
  { spr: 'highcourt', icon: true, x: 2330, y: 1560, fw: 232, fd: 56, mcol: '#c0473c' },
  { spr: 'library', icon: true, x: 2700, y: 1880, fw: 104, fd: 36, mcol: '#c0473c' },
  { spr: 'bandstand', x: 2450, y: 1960, fw: 30, fd: 12, mcol: '#efe7da' },
  { spr: 'museum', icon: true, x: 2880, y: 1700, fw: 160, fd: 40, mcol: '#d9c7a2', signs: [{ x: 85, y: 12, text: 'VISVESVARAYA MUSEUM', size: 3.4, color: '#ffffff' }] },
  { spr: 'stmarks', icon: true, x: 3720, y: 1870, fw: 110, fd: 44, mcol: '#f2efe6' },
  { spr: 'ubcity', icon: true, x: 3260, y: 2270, fw: 180, fd: 70, mcol: '#7fa6c4', signs: [{ x: 95, y: 188, text: 'UB CITY', size: 5, color: '#ffe7a8' }] },
  // K.R. Market, the fort, Basavanagudi.
  { spr: 'krmarket', icon: true, x: 1000, y: 2470, fw: 220, fd: 40, mcol: '#e3c06a', signs: [{ x: 115, y: 7, text: 'K.R. MARKET', size: 4.2, color: '#ffffff' }] },
  { spr: 'fort', x: 1330, y: 2480, fw: 96, fd: 24, mcol: '#a8a090' },
  { spr: 'tipu', icon: true, x: 1160, y: 2790, fw: 180, fd: 40, mcol: '#c99a5e' },
  { spr: 'vidyarthi', x: 1000, y: 2924, fw: 60, fd: 20, mcol: '#2f6b3a', signs: [{ x: 32, y: 8, text: 'VIDYARTHI BHAVAN', size: 3, color: '#ffffff' }] },
  { spr: 'bulltemple', icon: true, x: 990, y: 3300, fw: 100, fd: 40, mcol: '#d9cfb8' },
  { spr: 'buglerock', x: 1320, y: 3330, fw: 100, fd: 34, mcol: '#9c9a94' },
  // Lalbagh and Jayanagar.
  { spr: 'mtr', x: 1970, y: 2280, fw: 58, fd: 22, mcol: '#efe7da', signs: [{ x: 32, y: 9, text: 'MTR  1924', size: 4, color: '#2f6b3a', outline: null }] },
  { spr: 'glasshouse', icon: true, x: 2250, y: 2620, fw: 200, fd: 46, mcol: '#bfe3e8' },
  { spr: 'rock', x: 1800, y: 2900, fw: 100, fd: 34, mcol: '#9c9a94' },
  { spr: 'complex', x: 2780, y: 3230, fw: 146, fd: 36, mcol: '#d9cbb0', signs: [{ x: 75, y: 7, text: '4TH BLOCK COMPLEX', size: 4, color: '#ffffff' }] },
  { spr: 'bakery', x: 2620, y: 3240, fw: 48, fd: 18, mcol: '#f0d78a', signs: [{ x: 26, y: 8, text: 'IYENGAR BAKERY', size: 3.4, color: '#b8281e', outline: null }] },
  { spr: 'statue', x: 2050, y: 3066, fw: 8, fd: 6, mcol: null, island: true },   // centre of South End Circle
  // MG Road, Koramangala, Silk Board.
  { spr: 'flyover', x: 3020, y: 3500, fw: 0, fd: 0, mcol: null, signs: [{ x: 160, y: 6, text: 'SILK BOARD JN', size: 4, color: '#ffffff' }] },
  { spr: 'darshini', x: 3480, y: 2270, fw: 40, fd: 14, mcol: '#f2e0b0', signs: [{ x: 22, y: 6.5, text: 'FILTER KAAPI', size: 3.4, color: '#7a2b25', outline: null }] },
  { spr: 'stadium', x: 3300, y: 1436, fw: 0, fd: 0, mcol: null, icon: true, signs: [{ anchor: 'name', text: 'M. CHINNASWAMY STADIUM', size: 3.6, color: '#ffffff' }] },
  { spr: 'kingfisher', x: 3090, y: 2080, fw: 92, fd: 40, mcol: '#e9eef2', icon: true },
  { spr: 'hardrock', x: 3850, y: 2080, fw: 86, fd: 34, mcol: '#9a948a', icon: true, signs: [{ anchor: 'sign', text: 'HARD ROCK CAFE', size: 3.4, color: '#ffffff' }] },
  // Rajajinagar and Vijayanagar.
  { spr: 'iskcon', x: 740, y: 600, fw: 140, fd: 70, mcol: '#f2e2b8', icon: true },
  { spr: 'wtc', x: 180, y: 620, fw: 70, fd: 40, mcol: '#5f7f9f', icon: true },
  { spr: 'orion', x: 480, y: 640, fw: 140, fd: 40, mcol: '#c9d6e0', signs: [{ anchor: 'sign', text: 'ORION MALL', size: 4.4, color: '#ffffff' }] },
  { spr: 'temple', x: 160, y: 1560, fw: 50, fd: 22, mcol: '#e8dcc0' },
];

// Rows of shops, offices and homes.
(() => {
  const add = (spr, x, y, fw, fd, mcol, extra = {}) => B_BUILDINGS.push({ spr, x, y, fw, fd, mcol, ...extra });
  const shop = (x, y, sign, wall, board, awning) => add('shop', x, y, 60, 26, board, { shop: [wall, board, awning], signs: [{ x: 32, y: 20, text: sign, size: 4.2, color: '#ffffff' }] });
  // 8th Cross, Malleswaram.
  [['FLOWERS', '#f0d9a8', '#c0392b', '#f2c94c'], ['SWEETS', '#f4e3c3', '#8f2a25', '#d8433b'], ['SAREES', '#e9d2b8', '#6a2e7a', '#c3a0ec'], ['COFFEE', '#f0e6d0', '#5a3a26', '#2f8a3a'], ['BOOKS', '#dfe6ea', '#2f4f8a', '#5b8ee0']]
    .forEach(([s, w, b, a], i) => shop(900 + i * 70, 470, s, w, b, a));
  // Commercial Street.
  [['BANGLES', '#f4e3c3', '#c0392b', '#f2c94c'], ['FABRICS', '#e9d2b8', '#2f6db0', '#5b8ee0'], ['SHOES', '#dfe6ea', '#3a3530', '#d8433b'], ['JEWELS', '#f0e6d0', '#b8892a', '#f2c94c'], ['KURTAS', '#f4e3c3', '#2f8a3a', '#7cc35a'], ['TOYS', '#f0d9a8', '#ee8b3a', '#d8433b'], ['TAILOR', '#e9e4dc', '#5a3a26', '#a8843e'], ['SILKS', '#f0d9a8', '#8f2a25', '#d8433b'], ['SPICES', '#f2e0b0', '#a8551d', '#ee8b3a']]
    .forEach(([s, w, b, a], i) => shop(3080 + i * 70, i % 2 ? 540 : 392, s, w, b, a));
  // MG Road and Brigade Road.
  [['BOOKS', '#dfe6ea', '#2f4f8a', '#5b8ee0'], ['MUSIC', '#e9e4dc', '#3a3530', '#c3a0ec'], ['BREW PUB', '#c9a27a', '#3a2418', '#2f6b3a'], ['SILKS', '#f0d9a8', '#8f2a25', '#d8433b'], ['CAFE', '#f0e6d0', '#5a3a26', '#2f8a3a'], ['SPORTS', '#dfe6ea', '#2f6db0', '#d8433b']]
    .forEach(([s, w, b, a], i) => shop(3860 + i * 76, 1878, s, w, b, a));
  [['FASHION', '#f4e3c3', '#c3a0ec', '#7a52b0'], ['ICE CREAM', '#fbe3ec', '#d9668a', '#f4a3b8'], ['GAMES', '#dfe6ea', '#3a3530', '#5b8ee0'], ['SHOES', '#e9e4dc', '#8f2a25', '#d8433b']]
    .forEach(([s, w, b, a], i) => shop(i % 2 ? 3650 : 3550, 2000 + Math.floor(i / 2) * 120 + 60, s, w, b, a));
  [['PUB', '#c9a27a', '#3a2418', '#2f6b3a'], ['BOOKS', '#dfe6ea', '#2f4f8a', '#5b8ee0']]
    .forEach(([s, w, b, a], i) => shop(3410 + i * 70, 2080, s, w, b, a));
  // Chickpet and Majestic.
  [['SAREES', '#e9d2b8', '#6a2e7a', '#c3a0ec'], ['BANGLES', '#f4e3c3', '#c0392b', '#f2c94c'], ['STEEL', '#dfe6ea', '#5d6369', '#a3a9ae'], ['SILKS', '#f0d9a8', '#8f2a25', '#d8433b'], ['LODGE', '#f0e6d0', '#2f6b3a', '#7cc35a']]
    .forEach(([s, w, b, a], i) => shop(1110 + i * 70, 1890, s, w, b, a));
  [['MOBILES', '#dfe6ea', '#2f6db0', '#5b8ee0'], ['HOTEL', '#f0e6d0', '#8f2a25', '#f2c94c'], ['TEXTILES', '#e9d2b8', '#6a2e7a', '#d8433b'], ['BAGS', '#f4e3c3', '#3a3530', '#ee8b3a']]
    .forEach(([s, w, b, a], i) => shop(900 + i * 140, 2020, s, w, b, a));
  // Gandhi Bazaar.
  [['FLOWERS', '#f0d9a8', '#c0392b', '#f2c94c'], ['FRUITS', '#f4e3c3', '#2f8a3a', '#ee8b3a'], ['POOJA', '#f2e0b0', '#a8551d', '#f2c94c'], ['SWEETS', '#f4e3c3', '#8f2a25', '#d8433b']]
    .forEach(([s, w, b, a], i) => shop(1110 + i * 90, 2924, s, w, b, a));
  // Indiranagar.
  [['CAFE', '#f0e6d0', '#5a3a26', '#2f8a3a'], ['BREWERY', '#c9a27a', '#3a2418', '#ee8b3a'], ['BAKERY', '#fbe3ec', '#d9668a', '#f4a3b8'], ['VINYL', '#e9e4dc', '#3a3530', '#c3a0ec'], ['YOGA', '#dfe6ea', '#2f8a3a', '#7cc35a'], ['TACOS', '#f4e3c3', '#c0392b', '#f2c94c']]
    .forEach(([s, w, b, a], i) => shop(i % 2 ? 4470 : 4330, 900 + Math.floor(i / 2) * 260, s, w, b, a));
  // Koramangala offices, cafes and apartments.
  for (const [x, v] of [[3200, 0], [3420, 1], [3640, 2], [3900, 0], [4160, 1], [4420, 2]]) add(`office${v}`, x, 2780, 84, 40, '#7fb3c4');
  [['CAFE', '#f0e6d0', '#5a3a26', '#2f8a3a'], ['STARTUP', '#dfe6ea', '#2f6db0', '#5b8ee0'], ['BIRYANI', '#f4e3c3', '#8f2a25', '#f2c94c'], ['COWORK', '#e9e4dc', '#3a3530', '#ee8b3a'], ['DOSA', '#f2e0b0', '#2f6b3a', '#7cc35a']]
    .forEach(([s, w, b, a], i) => shop(3240 + i * 260, 2920, s, w, b, a));
  for (let i = 0; i < 6; i++) add(`apartment${i % 3}`, 3300 + i * 230, 3200, 64, 30, '#e9c9a8');
  for (let i = 0; i < 5; i++) add(`apartment${(i + 1) % 3}`, 3400 + i * 260, 2500, 64, 30, '#e9c9a8');
  // Majestic's lodges and hotels north of the railway, and the busy lanes by the bus station.
  [['LODGE', '#f0e6d0', '#2f6b3a', '#7cc35a'], ['HOTEL', '#f4e3c3', '#8f2a25', '#f2c94c'], ['MEALS', '#f2e0b0', '#a8551d', '#ee8b3a'], ['TRAVELS', '#dfe6ea', '#2f6db0', '#5b8ee0'], ['LODGE', '#e9d2b8', '#6a2e7a', '#c3a0ec'], ['HOTEL', '#f0d9a8', '#3a3530', '#d8433b'], ['BOOKS', '#dfe6ea', '#2f4f8a', '#5b8ee0'], ['SWEETS', '#f4e3c3', '#8f2a25', '#d8433b']]
    .forEach(([s, w, b, a], i) => shop(880 + i * 76, 860, s, w, b, a));
  for (let i = 0; i < 7; i++) add(`apartment${i % 3}`, 900 + i * 84, 1000, 64, 30, '#e9c9a8');
  [['SAREES', '#e9d2b8', '#6a2e7a', '#c3a0ec'], ['MOBILES', '#dfe6ea', '#2f6db0', '#5b8ee0'], ['MEALS', '#f2e0b0', '#a8551d', '#ee8b3a'], ['STEEL', '#dfe6ea', '#5d6369', '#a3a9ae'], ['TEXTILES', '#f0d9a8', '#8f2a25', '#d8433b'], ['FRUITS', '#f4e3c3', '#2f8a3a', '#ee8b3a'], ['HOTEL', '#f0e6d0', '#3a3530', '#f2c94c'], ['BAGS', '#f4e3c3', '#3a3530', '#ee8b3a']]
    .forEach(([s, w, b, a], i) => shop(880 + i * 76, 2150, s, w, b, a));
  for (let i = 0; i < 7; i++) add(`apartment${(i + 2) % 3}`, 900 + i * 84, 2270, 64, 30, '#e9c9a8');
  [['FLOWERS', '#f0d9a8', '#c0392b', '#f2c94c'], ['BANANAS', '#f4e3c3', '#2f8a3a', '#f2c94c'], ['SPICES', '#f2e0b0', '#a8551d', '#ee8b3a']]
    .forEach(([s, w, b, a], i) => shop(900 + i * 76, 2640, s, w, b, a));
  // Homes.
  let n = 0;
  const jrow = (xs, y) => xs.forEach(x => add(`jhouse${n++ % 6}`, x, y, 44, 18, '#e9c9a8', { house: 'j' }));
  const mrow = (xs, y) => xs.forEach(x => add(`mhouse${n++ % 4}`, x, y, 40, 16, '#b9573a', { house: 'm' }));
  for (const y of [3170, 3240]) jrow([2110, 2164, 2218, 2272, 2326, 2380, 2434, 2488], y);
  for (const y of [3340, 3410]) jrow([1560, 1614, 1668, 1722, 1776, 1830, 1884, 1938, 2110, 2164, 2218, 2272, 2326, 2380, 2434, 2488, 2600, 2654, 2708, 2762, 2816, 2870, 2924], y);
  for (const y of [3510, 3590]) jrow([1560, 1614, 1668, 1722, 1776, 1830, 1884, 1938, 2110, 2164, 2218, 2272, 2326, 2380, 2434, 2488, 2600, 2654, 2708, 2762, 2816, 2870, 2924], y);
  jrow([2600, 2910], 3170);
  jrow([1560, 1614, 1668, 1722, 1776, 1830, 1884], 3170);
  mrow([870, 1120, 1180, 1240, 1300, 1360, 1420], 300);
  mrow([880, 940, 1000, 1060, 1120, 1180, 1240, 1300, 1360, 1420], 640);
  mrow([880, 940, 1000, 1060, 1180, 1240, 1300, 1420], 3460);
  mrow([880, 940, 1000, 1060, 1180, 1240, 1300, 1360, 1420], 3580);
  // Rajajinagar and Vijayanagar homes.
  jrow([40, 94, 148, 202, 256, 360, 414, 468, 522, 576], 900);
  jrow([40, 94, 148, 202, 256, 360, 414, 468, 522, 576, 720, 774], 1000);
  [40, 120, 380, 464, 548, 720, 800].forEach((x, i) => add(`apartment${i % 3}`, x, 800, 64, 30, '#e9c9a8'));
  for (const y of [1700, 1790, 1880, 1970, 2080]) { jrow([40, 94, 148, 202, 256, 310, 364, 418, 472, 526, 580], y); mrow([710, 770], y); }
  for (const y of [2320, 2410, 2500, 2590, 2680, 2770, 2860, 2950, 3040, 3130, 3220, 3310, 3400, 3490, 3580]) { (y % 180 === 40 ? mrow : jrow)([40, 94, 148, 202, 256, 310, 364, 418, 472, 526, 580], y); mrow([710, 770], y); }
})();

const B_NPCS = [
  { name: 'Porter', x: 1180, y: 1096, skin: '#7a5236', hair: '#1d1816', top: '#c0392b', bottom: '#c0392b',
    lines: ['Luggage? I carry anything. Even a knight.', 'Mysuru train, platform one!'] },
  { name: 'Devotee', x: 700, y: 630, skin: '#c48a5c', hair: '#1d1816', top: '#ee8b3a', bottom: '#f4f1ea',
    lines: ['Hare Krishna! The free prasadam is very good.', 'Count the steps up the hill. I lost count at forty.'] },
  { name: 'Shopper', x: 480, y: 668, area: { x: 420, y: 660, w: 160, h: 16 }, skin: '#9a6a45', hair: '#2b2220', top: '#d8433b', bottom: '#2b2a33',
    lines: ['Orion has a lake. A mall with a lake!', 'One more shop. Then home. Probably.'] },
  { name: 'Guitarist', x: 3850, y: 2098, skin: '#c48a5c', hair: '#2b2220', top: '#2b2220', bottom: '#2f4f8a',
    lines: ['Rock on, little knight!', 'Bengaluru is the rock capital of India. Fight me.'] },
  { name: 'Conductor', x: 1100, y: 1716, skin: '#9a6a45', hair: '#1d1816', top: '#5b7fae', bottom: '#2b2a33',
    lines: ['Right, right! Hold on!', 'Change? Give exact change, please.'] },
  { name: 'Cubbon walker', x: 2400, y: 1760, area: { x: 2120, y: 1752, w: 840, h: 20 }, skin: '#c48a5c', hair: '#d9d2c4', top: '#ffffff', bottom: '#2b2a33',
    lines: ['Third round done. Now, idli.', 'Bengaluru weather, no? Best in India.'] },
  { name: 'Jogger', x: 2560, y: 1900, area: { x: 2550, y: 1460, w: 20, h: 800 }, skin: '#9a6a45', hair: '#1d1816', top: '#ee8b3a', bottom: '#2b2a33',
    lines: ['Ten thousand steps! Then filter coffee.'] },
  { name: 'Guard', x: 2600, y: 1376, skin: '#7a5236', hair: '#1d1816', top: '#c9b48a', bottom: '#c9b48a', cap: '#2f4f8a',
    lines: ['Photos are allowed. Climbing the dome is not.', "Government work is God's work. Lunch is at one."] },
  { name: 'Palace guide', x: 2480, y: 640, skin: '#c48a5c', hair: '#1d1816', top: '#7a2b25', bottom: '#2b2a33',
    lines: ['The towers were built to look like an English castle.', 'Concerts happen on these grounds. Very loud ones.'] },
  { name: 'Turf fan', x: 1700, y: 936, area: { x: 1580, y: 930, w: 380, h: 10 }, skin: '#c48a5c', hair: '#5a4a3a', top: '#d8433b', bottom: '#2b2a33',
    lines: ['Number four! Come on, number four!', 'I bet my lunch on the grey one.'] },
  { name: 'Cricket fan', x: 3300, y: 1446, skin: '#9a6a45', hair: '#1d1816', top: '#c0392b', bottom: '#2b2220',
    lines: ['Ee sala cup namde!', 'Kohli fan since birth. Before birth, actually.'] },
  { name: 'Techie', x: 3300, y: 2960, area: { x: 3100, y: 2950, w: 1400, h: 40 }, skin: '#c48a5c', hair: '#2b2220', top: '#5b8ee0', bottom: '#4a4f58',
    lines: ['Sorry, on a call. Standup in five.', 'My commute is two hours. For six kilometres.', 'Hotfix on Friday evening. Classic.'] },
  { name: 'Founder', x: 3700, y: 2830, skin: '#9a6a45', hair: '#1d1816', top: '#2b2a33', bottom: '#4a4f58',
    lines: ['We are like Uber, but for filter coffee.', 'Series A closes on Monday. Probably.'] },
  { name: 'Commuter', x: 3150, y: 3420, skin: '#c48a5c', hair: '#1d1816', top: '#f4f1ea', bottom: '#2b2a33',
    lines: ['Silk Board. I have been here since Tuesday.', 'Google Maps says forty minutes. Google Maps lies.'] },
  { name: 'Auto anna', x: 3140, y: 2320, skin: '#7a5236', hair: '#1d1816', top: '#d9c7a2', bottom: '#d9c7a2',
    lines: ['Meter? Meter is sleeping. Fifty extra.', 'Bartheera? Coming? Return is empty, saar.', 'Silk Board? Ayyo, no.'] },
  { name: 'Busker', x: 3700, y: 1930, skin: '#c48a5c', hair: '#2b2220', top: '#c3a0ec', bottom: '#2b2a33',
    lines: ['Requests? I know three songs.', 'Brigade Road on a Saturday is the best stage.'] },
  { name: 'Barista', x: 4410, y: 1100, skin: '#9a6a45', hair: '#2b2220', top: '#5a3a26', bottom: '#2b2a33',
    lines: ['Single origin from Chikmagalur. Smell that.', 'Filter coffee or a flat white? Trick question.'] },
  { name: 'Boatman', x: 4250, y: 652, skin: '#7a5236', hair: '#1d1816', top: '#f4f1ea', bottom: '#2f6db0',
    lines: ['Row to the island? Ten minutes, no splashing.'] },
  { name: 'Shopkeeper', x: 3300, y: 430, skin: '#c48a5c', hair: '#1d1816', top: '#f2c94c', bottom: '#2b2a33',
    lines: ['Best price, only for you!', 'Bangles in every colour. Even knight grey.'] },
  { name: 'Flower seller', x: 1000, y: 2500, skin: '#8a5a3a', hair: '#1d1816', top: '#f2c94c', bottom: '#f2c94c', saree: true,
    lines: ['Mallige, jasmine! One metre for the kitten?', 'Marigolds for the festival, cheap cheap!'] },
  { name: 'Priest', x: 990, y: 3316, skin: '#9a6a45', hair: '#1d1816', top: '#f4f1ea', bottom: '#ee8b3a',
    lines: ['The big Nandi was carved from a single rock.', 'Come back for the groundnut fair.'] },
  { name: 'Waiter', x: 1000, y: 2944, skin: '#c48a5c', hair: '#1d1816', top: '#f4f1ea', bottom: '#f4f1ea',
    lines: ['Masala dosa, extra butter? Coming!', 'We carry twenty dosas on one arm.'] },
  { name: 'Aunty', x: 2300, y: 3330, area: { x: 2100, y: 3320, w: 400, h: 14 }, skin: '#b5784a', hair: '#1d1816', top: '#c3a0ec', bottom: '#c3a0ec', saree: true,
    lines: ['Oota aytha? Have you eaten?', 'Come, come, there is fresh holige.'] },
  { name: 'Gardener', x: 2300, y: 2700, area: { x: 2100, y: 2680, w: 300, h: 60 }, skin: '#7a5236', hair: '#1d1816', top: '#2f6b3a', bottom: '#d9c7a2',
    lines: ['The flower show is in January. Come back!', 'That clock? Made of flowers. Keeps time too.'] },
  { name: 'Malleswaram grandma', x: 1060, y: 492, skin: '#8a5a3a', hair: '#d9d2c4', top: '#d8433b', bottom: '#d8433b', saree: true,
    lines: ['This street has had the best flowers since my wedding.', 'Malleswaram coffee is the real coffee.'] },
  { name: 'Darshini anna', x: 3480, y: 2278, skin: '#8a5a3a', hair: '#1d1816', top: '#ffffff', bottom: '#2f8a3a', shop: 'coffee',
    lines: ['One by two coffee? Free for knights.'] },
  { name: 'Baker', x: 2620, y: 3250, skin: '#c48a5c', hair: '#1d1816', top: '#ffffff', bottom: '#2f6db0', shop: 'cake',
    lines: ['Honey cake, fresh from the oven!'] },
];
