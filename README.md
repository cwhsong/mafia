# Mafia: Daybreak

Play Mafia in person. Phones run the night; the narrator runs the story.

Live: https://cwhsong.github.io/mafia/

## Running it locally

| Command | What it does |
| --- | --- |
| `npm run dev` | The app at `http://localhost:5173/mafia/`. Tabs in one browser talk to each other directly; no Firebase needed. Test mode is on. |
| `npm test` | Engine, transport and UI tests (fast, no setup). |
| `npm run build` | Type-checks everything and builds the site into `dist/`. |
| `npm run emulators` | Starts the Firebase emulators (database + sign-in) on your laptop. Needs Java 21. |
| `npm run dev:firebase` | The app using the real Firebase code, pointed at the emulators. Run `npm run emulators` first. |
| `npm run test:rules` | Security-rules and integration tests against the emulator. Needs Java 21. CI runs these on every PR. |

## Test mode

Add `?test` to the address (`https://cwhsong.github.io/mafia/?test`) to:

- show **+ 5 test players** in the narrator's lobby, and
- make every tab a separate player, so you can host in one tab and join in another.

Without `?test`, each browser is one person (as on real phones).

## How it fits together

- `src/engine`: the rules, as plain TypeScript. Every change goes through `reduce(state, command)`.
- `src/roles`: one file per role.
- `src/transport`: how devices share a room. `localTransport` (tabs) for development, `firebase/` for the live site. Both implement `RoomConnection`.
- `src/ui`: React screens. The room state decides which screen shows.
- `database.rules.json`: who can read and write what in Firebase. Publish changes in the Firebase console (Realtime Database → Rules).
