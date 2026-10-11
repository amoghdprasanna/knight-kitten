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
- **Bengaluru**: free roam around a pocket-sized Bengaluru: Vidhana Soudha,
  the High Court, Cubbon Park, UB City, Chinnaswamy Stadium, the Race Course
  and Holiday Inn, Lalbagh (Glass House, the rock, the flower clock), MTR and
  Jayanagar's pink tabebuia "cherry blossom" avenues, with R.K. Narayan's
  Malgudi next door (the station and steam train, Swami under the banyan, the
  Sarayu ghats). Collect a postcard at each of 16 landmarks, ride the Purple
  and Green lines of Namma Metro, talk to people, and watch day turn to night.
  The minimap and city map (M) let you set a destination; V switches between
  street, drone, Malgudi sketch and close-up views.

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
- `city.js`: Bengaluru mode (city layout, art, traffic, metro, views, map)
- `vendor/matter.min.js`: [Matter.js](https://brm.io/matter-js/) 0.20.0 (MIT)
