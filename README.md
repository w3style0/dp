# Quarter View Prototype

Three.js prototype with an isometric-style quarter view.

## Run

```bash
npm install
npm run dev
```

Open the local URL shown by Vite in your browser.

## Current Features

- Isometric-style camera
- Battle board style ground
- Auto-load every `.glb` file from `model`
- One model becomes the player
- All other models become NPCs
- Move with `WASD` or arrow keys
- Switch between `idle` and `walk/run` animations when the player moves

## Player Model Rule

The code tries to pick a player model first if the file name contains:

- `chibi`
- `jinx`
- `katarina`
- `blitz`

If none of those exist, it uses the first `.glb` file as the player.

You can change that logic in [src/main.js](C:/Users/1/Desktop/project/00%20QUATER%20VIEW/src/main.js).

## Animation Rule

If the player GLB contains animation clips with names like `idle`, `walk`, `run`, or `move`,
the app will try to use them automatically.

## Add More Models

Put more `.glb` files into [model](C:/Users/1/Desktop/project/00%20QUATER%20VIEW/model).
They will be included automatically the next time you run the app.
