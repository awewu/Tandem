# Tauri Desktop Build

## Prerequisites
- [Rust](https://rustup.rs/) installed
- Node.js dependencies: `npm install`

## Development
```bash
npm run tauri:dev
```

## Build
```bash
npm run tauri:build
```

Output will be in `src-tauri/target/release/bundle/`.

## Architecture
- `src/main.rs` - Rust backend with Hermes CLI integration
- `lib/tauri.ts` - Frontend adapter (Web/Desktop unified API)
- Commands: health, skills, cron (list/create/action), chat_stream
