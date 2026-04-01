# Festival Assets Checklist

## Goal
Build a more believable Stardew-inspired night festival scene for the birthday ending.

Prefer one or two matching asset packs instead of mixing many unrelated styles.

## Recommended Sources
- `itch.io`: main source for cohesive pixel-art packs.
- `OpenGameArt`: free backup source for tiles, roads, plants, and props.
- `Lospec`: palette reference for cozy color matching.
- `Freesound`: ambience and soft UI/gameplay audio.

Suggested starting points:
- Pixelwood Valley
- Pix-Quest
- Village pixel art RPG packs
- Biruk Okami packs
- Gowl / cozy UI and props packs

## Folder Plan
- `public/festival/background`
- `public/festival/props`
- `public/festival/npc`
- `public/festival/ui`
- `public/festival/audio`
- `public/festival/_raw` (archived source packs, not for runtime paths)

## Current Inventory Snapshot (2026-03-26)
- Runtime-ready assets are now classified under:
  - `public/festival/background`
  - `public/festival/props`
  - `public/festival/npc`
  - `public/festival/ui`
  - `public/festival/audio`
- Archived source packs were moved to `public/festival/_raw`:
  - audio pack (`100` files)
  - tile pack (`132` files)
  - tilemap pack
  - character pack
  - environment pack
- Cleanup done:
  - removed all `*:Zone.Identifier` sidecar files
  - removed duplicate `right-hintbox-question-mark (1).png`
  - deleted obsolete root `gift.png` and replaced with canonical `public/festival/props/gift.png`

## Runtime Asset Status

### Ready
- `public/festival/props/cake.png`
- `public/festival/props/gift.png`
- `public/festival/npc/emily.png`
- `public/festival/npc/abigail.png`
- `public/festival/npc/leah.png`
- `public/festival/npc/sam.png`
- `public/festival/npc/player.png`
- `public/festival/ui/dialog-frame.png`
- `public/festival/ui/nameplate.png`
- `public/festival/audio/night-ambience.ogg`
- `public/festival/audio/light-on.ogg`
- `public/festival/audio/reveal.ogg`
- `public/festival/audio/advance.ogg`

### Still Missing For Final Polish
- `public/festival/ui/continue-button.png` (optional, current button is CSS-based)

### In-Repo Candidates For Missing Assets
- Promoted into runtime paths:
  - `public/festival/background/sky.png` from `public/festival/_raw/environment-pack/sunset.png`
  - `public/festival/background/ground.png` from `public/festival/_raw/tilemap-pack/tilemap_packed.png`
  - `public/festival/props/lights.png` from `public/asset-library/festival/props/wooden/2.png`
  - `public/festival/props/table.png` from `public/asset-library/festival/props/wooden/1.png`
  - `public/festival/props/flowers.png` from `public/asset-library/festival/environment/trees/3.png`

## Must-Have Assets

### Background
- `public/festival/background/sky.png`
  Use: night sky, stars, moonlight, distant hills
  Suggested size: 1600px wide or larger
  Notes: transparent layer preferred

- `public/festival/background/ground.png`
  Use: plaza floor, grass, paths
  Suggested size: 1600px wide or larger
  Notes: keep perspective consistent with top-down / angled festival layout

### Props
- `public/festival/props/lights.png`
  Use: hanging festival lights or light strings
  Notes: transparent PNG, easy to repeat horizontally

- `public/festival/props/table.png`
  Use: main foreground table for cake and gifts

- `public/festival/props/cake.png`
  Use: final beat highlight

- `public/festival/props/gift.png`
  Use: shrimp-foreshadow payoff object

- `public/festival/props/flowers.png`
  Use: foreground decoration and cozy framing

### Characters
- `public/festival/npc/emily.png`
- `public/festival/npc/abigail.png`
- `public/festival/npc/leah.png`
- `public/festival/npc/sam.png`
- `public/festival/npc/player.png`
  Use: standing or idle sprites only for first pass
  Suggested format: transparent PNG or sprite sheet

### UI
- `public/festival/ui/dialog-frame.png`
  Use: dialogue box base

- `public/festival/ui/nameplate.png`
  Use: speaker label

## Nice-to-Have Assets
- `public/festival/props/banner.png`
- `public/festival/props/lantern.png`
- `public/festival/props/chair.png`
- `public/festival/props/fireflies.png`
- `public/festival/ui/continue-button.png`

## Audio
- `public/festival/audio/night-ambience.ogg`
  Use: crickets, soft wind, village night ambience

- `public/festival/audio/light-on.ogg`
  Use: lights turning on

- `public/festival/audio/reveal.ogg`
  Use: gift reveal or emotional beat

- `public/festival/audio/advance.ogg`
  Use: dialogue advance click

## Asset Rules
- Prefer `PNG` for layered art and props.
- Use transparent backgrounds whenever possible.
- Keep pixel scale consistent across all characters and props.
- Avoid mixing more than two different art packs in one scene.
- Test readability at actual in-game size before committing to a pack.

## Collection Priority
1. Background sky
2. Ground / plaza
3. Lights
4. Table
5. Cake
6. Gift
7. NPC sprites
8. Dialogue UI
9. Audio

## Minimum Pack To Start Implementation
You can begin the improved festival scene once you have:
- one sky layer
- one ground layer
- one lights asset
- one table asset
- one cake asset
- one gift asset
- five character sprites
- one dialogue frame
