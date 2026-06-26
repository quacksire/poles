# Poles

A GTFS-first stop survey template for transit agencies, advocates, and ops teams.

Drop the contents of an agency's `gtfs.zip` into [`gtfs/`](./gtfs), rebuild, and Poles will:

- derive the stop map from `stops.txt`
- attach serving routes and agencies from `routes.txt`, `trips.txt`, and `stop_times.txt`
- show feed metadata in the UI
- auto-seed/upsert the current stop inventory into D1 before reports are read or written

The current repo is wired to the `commute.org` feed that is already checked in.

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/quacksire/poles)

The button is the main deploy path. Cloudflare can provision the app and its D1 binding from `wrangler.jsonc`, then run the deploy script.

## GTFS contract

Poles expects extracted GTFS text files in `gtfs/`.

Required files:

- `agency.txt`
- `routes.txt`
- `stops.txt`
- `trips.txt`
- `stop_times.txt`

Optional but used when present:

- `feed_info.txt`

Every other GTFS file can stay in the folder without any extra configuration.

## Local development

1. Replace the contents of `gtfs/` with another agency's extracted GTFS files when you want to retarget the app.
2. Install dependencies with `npm install`.
3. Apply local D1 migrations with `npm run db:migrate:local`.
4. Start Astro in background mode with `astro dev --background`.
5. Check the server with `astro dev status` and logs with `astro dev logs`.

When the app starts hitting `/api/reports`, it will sync the current GTFS-derived stop inventory into D1 automatically.

## What changes when you swap feeds

You do not need to hand-maintain any stop inventory file in `src/lib`.

Poles rebuilds these from GTFS automatically:

- stop coordinates, names, codes, and URLs
- scheduled serving routes per stop
- serving agencies per stop
- feed-level title, version, and service window
- searchable stop metadata used by the map drawer

The survey questions stay generic, while the official context becomes feed-specific.

## Cloudflare deploy notes

The deploy button should handle the template flow for a fresh account. Because this app needs D1, make sure the `DB` binding stays in `wrangler.jsonc` and that the deploy script runs migrations by binding name.

If you are not deploying through the button, you may still need to create or bind the database manually before running `npm run db:migrate`.

After the initial deploy, GTFS swaps should only require replacing the files in `gtfs/` and redeploying.

## Scripts

- `npm run build` builds the Astro worker bundle.
- `npm run deploy` builds and deploys with Wrangler.
- `npm run db:migrate` applies D1 migrations to the remote `DB` binding.
- `npm run db:migrate:local` applies D1 migrations to the local `DB` binding.
