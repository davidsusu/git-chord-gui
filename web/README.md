# Git Chord GUI

Local web GUI runner for Git Chord. It starts a Next.js server bound to
`127.0.0.1`, points it at a directory, and executes only `git chord` commands
from the browser UI.

## Requirements

- Node.js `>=18.17.0`
- npm/npx
- Git
- A `git chord` command on `PATH`, or `GIT_CHORD_COMMAND_PATH` pointing to the
  executable

## Run With npx

```sh
npx git-chord-gui [directory] [-p <port>] [-b]
```

Arguments and options:

- `directory`: optional directory to open; defaults to the current working
  directory.
- `-p, --port <port>`: preferred local port; defaults to `3333`. If the port is
  busy, the runner tries the next available port.
- `-b, --launch-browser`: opens the local GUI URL in the default browser if a
  browser launcher is available.
- `--help`: prints command help.

Examples:

```sh
npx git-chord-gui
npx git-chord-gui some/git/path -p 3334
npx git-chord-gui . --launch-browser
```

The command runs in the foreground. Stop it with `Ctrl+C`.

## Environment

- `GIT_CHORD_COMMAND_PATH`: absolute path to the `git-chord` executable. If this
  is unset, the server uses `git chord` from `PATH`.
- `PORT`: default port value when `-p`/`--port` is omitted.

## Development

Install dependencies:

```sh
npm install --legacy-peer-deps
```

Run the development server:

```sh
npm run dev -- [directory] -p 3333
```

Build the production Next.js app:

```sh
npm run build
```

Run the production server from this source directory:

```sh
npm start -- [directory]
```

## Build an npx Package

Create a production build and an npm tarball under `package-dist/`:

```sh
npm run build:npx
```

Install the packed command locally for the current user:

```sh
npm install -g --prefix "$HOME/.local" package-dist/git-chord-gui-0.1.0-SNAPSHOT.tgz
```

After installation, verify it with:

```sh
npx git-chord-gui --help
```
