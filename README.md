[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/kenziexbt0-dot/gta6-03/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/kenziexbt0-dot/gta6-03/reward.svg)](https://make.fun/c/gta6-01)

# Solmarina — an open-world crime game

Mara Voss owes Dario Venn money. Lena Kade, who runs the marina garage, has
work for her. Explore the sun-soaked coastal city of Solmarina on foot and by
car, steal cars, outrun the Solmarina police, and run seven story missions —
from a first meeting at the marina to a final escape across the North Bridge.

An original game: its city, characters, vehicles, names, story, art and sounds
are all its own. Nothing is taken from any commercial game.

## Play it

```sh
node serve.ts
```

Then open <http://localhost:8080> in a desktop browser. No build step, no
network requests — `game/` is plain static files.

| Key | Action |
| --- | --- |
| W A S D / arrows | Move on foot, drive when in a car |
| Shift | Run |
| E | Enter / exit a car |
| F | Punch |
| Mouse click / Space | Shoot (aim with the mouse) |
| P / Esc | Pause |
| Q | Save game |
| L | Load save |
| M | Mute sound |
| Enter | Start, or continue after Wasted / Busted |

## What's in the city

- **Open world:** a road-grid coastal city with a beach, the sea, a marina with
  docks, a park, a motel, a garage, a warehouse and a safehouse.
- **Traffic and pedestrians:** cars drive the avenues and turn at
  intersections; pedestrians walk the sidewalks and scatter from gunfire.
- **Steal and drive:** take any parked or traffic car, with arcade handling,
  skids, smoke and crash damage.
- **Wanted level:** five stars. Crimes draw police cars that chase, ram and
  bust you; break line of sight and stay hidden until the heat fades.
- **Missions and story:** seven missions in order, each with its objective on
  the HUD, a beacon and a minimap marker, and a cash reward.
- **Combat:** punches and hitscan gunfire; armed thugs shoot back during the
  warehouse defense.
- **HUD and minimap:** cash, health, ammo, speed, wanted stars, mission
  objective, message feed and a live minimap with the player, police and
  mission marker.
- **Save / load:** progress persists in localStorage.
- **Sound:** everything is synthesized live with WebAudio — engine hum,
  sirens, gunshots, impacts and jingles. No audio files.
- **Effects:** skid smoke, crash sparks, muzzle flashes, tracers, impact
  stars and drifting sea spray.

## Layout

```
game/
  index.html          the page: one canvas, one module script
  src/
    main.js           boot, game loop, screen state machine
    config.js         tuning constants and the city palette
    random.js         seeded RNG (mulberry32) and small math helpers
    world.js          the city: roads, buildings, beach, marina, landmarks
    player.js         Mara on foot and behind the wheel; cars
    traffic.js        traffic cars and pedestrians
    police.js         wanted level and the police response
    missions.js       the seven-mission story
    combat.js         punches, gunfire, thugs, ammo pickups
    render.js         the city, entities, HUD, minimap and menus
    effects.js        particles: smoke, sparks, flashes, tracers
    input.js          keyboard and mouse state
    audio.js          synthesized WebAudio sound
    shots.js          deterministic ?shot= staging for screenshots
    save.js           localStorage save / load
main.ts               the make.fun entry program (copies game/ + screenshots/,
                      writes dossier.json)
serve.ts              tiny static server for local play
shots.json            the four screenshot scenes and their URLs
screenshots/          1-start, 2-play, 3-chase, 4-mission (1280x720)
```

## Screenshots

The four screenshots are real renders of the game itself, taken headless from
`?shot=...&seed=1` URLs staged by `game/src/shots.js`: the title screen over
the city, driving with the HUD and minimap, a three-star police chase, and a
mission in progress at the Old Pier.

## License

MIT — see [LICENSE](LICENSE).
