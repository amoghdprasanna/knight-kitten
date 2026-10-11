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
- **Bengaluru**: free roam around a pocket-sized Bengaluru laid out after
  the real city: Malleswaram and Sankey Tank, Bangalore Palace, the Race
  Course and Holiday Inn, Majestic (KSR station, the bus station), Vidhana
  Soudha and the High Court, Cubbon Park, Chinnaswamy Stadium, MG Road and
  Brigade Road, Commercial Street, Ulsoor Lake, Indiranagar, K.R. Market,
  the fort and Tipu Sultan's Summer Palace, Basavanagudi (Bull Temple,
  Bugle Rock, Vidyarthi Bhavan), Lalbagh, Jayanagar's pink tabebuia
  "cherry blossom" avenues, Koramangala and Silk Board. R.K. Narayan's
  Malgudi lies across the river Sarayu, linked to KSR by the steam-hauled
  Malgudi Express. Collect a postcard at each landmark, ride the Purple and
  Green lines of Namma Metro (change at Majestic), talk to people, and watch
  day turn to night. The minimap and city map (M) let you set a destination;
  V switches between street, drone, Malgudi sketch and close-up views.

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
- `city-data.js`, `city-art.js`, `city.js`: Bengaluru mode (map layout and
  text, pixel art, and the engine: traffic, trains, views, map, HUD)
- `tests/`: the test pipeline
- `vendor/matter.min.js`: [Matter.js](https://brm.io/matter-js/) 0.20.0 (MIT)

## Tests

`npm test` runs the game in headless Chrome and checks that it boots
cleanly, that every mode survives several minutes of a bot playing it, that
the Bengaluru map has no overlapping buildings, unreachable landmarks or
signs that don't fit, that every metro and steam ride arrives, and that
every player-facing string is spelled correctly. It also saves screenshots
of key scenes to `tests/output/` for a human to look over.

```sh
npm install
npm test               # everything (about 20 seconds)
npm test -- --quick    # shorter bot runs
npm test -- city text  # only some suites: boot, text, city, modes, shots
```

Chrome is found automatically, or set `CHROME_PATH`. Real names (places,
Kannada words) that the spell check doesn't know go in
`tests/allowed-words.txt`. The same tests run on GitHub Actions for every
push, with the screenshots attached to the run.
