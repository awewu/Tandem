/** @type {import('next').NextConfig} */
// Backend access is handled server-side via src/lib/api.ts + /api/session/*
// route handlers (httpOnly JWT cookie). Configure the control-plane backend with:
//   NEXUS_API_URL     default http://localhost:3300  (NestJS service)
//   NEXUS_API_PREFIX  default /api/v2
// No client-side rewrite/proxy is used — the hub never exposes the raw token.
const nextConfig = {};

module.exports = nextConfig;
