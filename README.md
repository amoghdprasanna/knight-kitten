# Knight Kitten & the Tiny Inconveniences

A pixel-art browser game about a tiny armored kitten who treats everyday
annoyances like final bosses. Plays on desktop, iPad and phones (touch
controls appear automatically), and supports gamepads.

## Modes

- **Story**: guard the Human's nap from morning to night. Alarm clocks and
  notifications head for the cottage door; stop them, survive three waves per
  time of day, then beat the boss (Monday 9AM, The Cucumber, The Vacuum, Bath
  Time). Each new day is harder.
- **Journey**: a side-scrolling run across seven lands to Grandma's house.
  Rescue stray cats (14 breeds) who join your party, collect fish, survive two
  boss chases.
- **Endless**: waves forever, a boss every fifth wave, a new modifier every
  four waves.
- **Boss Rush**: all four bosses back to back against the clock.
- **Daily**: the same seeded run for everyone each day, with two modifiers.
- **Bengaluru**: free roam around Bengaluru, laid out from the real latitude
  and longitude of its landmarks, metro stations and main roads (mostly from
  Wikipedia, OpenStreetMap-based listings and plus codes; a few are estimated
  from nearby places). As on an illustrated tourist map, the old city is
  drawn at a larger scale than the suburbs, but whatever is north or east of
  something in Bengaluru is north or east of it here too (a few landmarks
  are nudged to sit on the right side of their road), and roads slant where
  the real ones do. North to south: Yeshwanthpur, Rajajinagar (ISKCON, and
  the World Trade Center and Orion Mall at Brigade Gateway), Malleswaram
  (Kadu Malleshwara, CTR) and Sankey Tank, Bangalore Palace, the Cantonment
  station, Shivajinagar (St. Mary's Basilica, Russell Market, Commercial
  Street), Ulsoor Lake and the Someshwara Temple, Indiranagar, the Race Course,
  the Planetarium, Majestic (KSR, the bus station, the cinemas), Vidhana
  Soudha, the High Court and Cubbon Park with its museums and library,
  Chinnaswamy Stadium, MG Road, Brigade Road, St. Mark's Cathedral, the Hard
  Rock Cafe, Mayo Hall, UB City and Kingfisher Towers, Chickpet, K.R. Market, the fort and Tipu Sultan's Summer
  Palace, the Town Hall and MTR, Lalbagh, Basavanagudi (Bull Temple, Bugle
  Rock, Gavi Gangadhareshwara, Vidyarthi Bhavan), Jayanagar's pink tabebuia
  avenues, Koramangala and Silk Board; out west, Vijayanagar and the Gali
  Anjaneya Temple on Mysore Road. Trains run in from the west to KSR.
  Collect a postcard at each landmark. Ride the Purple, Green and Yellow lines
  of Namma Metro on their real routes, from Mysore Road and Yeshwanthpur to
  Indiranagar and Bommanahalli: they go underground through the old city
  (City Railway Station to Cubbon Park, and Majestic to K.R. Market), and the
  Yellow Line runs over the Silk Board double-decker. The train stops at every
  station (hold dash to hurry it along), and V switches between a window
  seat, the train from outside, and the skyline from beside the viaduct with
  the landmarks named as they pass. Take an
  auto-rickshaw from a stand to wherever you are headed, look for fourteen
  hidden cats, talk to people, and watch day turn to night. Buildings are
  drawn in 3D: landmarks are modelled one by one (temples with their gopurams
  and vimanas), and everyday shops, flats, houses and offices carry the
  rooftop water tanks, stair rooms and washing lines of a Bengaluru skyline;
  Bangalore Palace, Chinnaswamy Stadium, ISKCON and the towers are full 3D
  models.
  The city map (M) zooms in three steps, shows real distances and suggests a
  metro route; V switches between street, drone, Malgudi sketch and close-up
  views.

Fish collected in any mode buy capes, bows and armor in the shop.

## Controls

| | Keyboard | Touch | Gamepad |
|---|---|---|---|
| Move (arena) | WASD / arrows | left-side stick | stick / d-pad |
| Attack | J | HIT | X |
| Jump (press twice to double jump) | K / Space | JUMP (Journey: hold left side) | A |
| Dash (hold to sprint) | L / Shift | DASH | B |
| Pause | Esc / P | II | Start |
| Map / view (Bengaluru) | M / V | MAP / VIEW | Select / LB |

In the arena, three hits make a launcher combo and jump + attack is a ground
pound. Rocks, hay bales, haystacks, crates, stumps and the well can be climbed.
In Journey, hold jump to charge a higher leap.

## Running locally

It's a static site with no build step. Serve the folder and open it:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` directly also works, but offline caching (the service
worker) only runs when served over http(s).

## Files

- `index.html`: page, touch controls, menus
- `main.js`: boot, menus, main loop
- `core.js`: canvas sizing, saves, cosmetics
- `ui.js`: sharp text/HUD layer and menu navigation
- `input.js`, `audio.js`: controls and the WebAudio synth/music
- `sprites.js`: all pixel art (hand-drawn grids and procedural props)
- `world.js`: the arena world, time of day, critters
- `arena.js`, `modes.js`: arena gameplay and its four modes
- `journey.js`: Journey mode
- `city-data.js`, `city-art.js`, `city.js`: Bengaluru mode (the map from real
  coordinates and its text, pixel art, and the engine: traffic, trains,
  autos, views, map, HUD)
- `tests/`: the test pipeline
- `vendor/matter.min.js`: [Matter.js](https://brm.io/matter-js/) 0.20.0 (MIT)

## Tests

`npm test` runs the game in headless Chrome and checks that it boots
cleanly, that every mode survives several minutes of a bot playing it, that
the Bengaluru map has no overlapping buildings, buildings hiding roads or
each other, unreachable landmarks or signs that don't fit, that every metro
and auto ride arrives, and that every player-facing string is spelled
correctly. It also saves screenshots
of key scenes to `tests/output/` for a human to look over.

```sh
npm install
npm test               # everything (a few minutes: it rides every metro route)
npm test -- --quick    # shorter bot runs
npm test -- city text  # only some suites: boot, text, city, modes, shots
```

Chrome is found automatically, or set `CHROME_PATH`. Real names (places,
Kannada words) that the spell check doesn't know go in
`tests/allowed-words.txt`. The same tests run on GitHub Actions for every
push, with the screenshots attached to the run.
