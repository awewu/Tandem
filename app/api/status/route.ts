import { runHermes } from '@/lib/hermes-cli';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface KeyState {
  name: string;
  configured: boolean;
  hint?: string;
}

export interface HermesStatus {
  ok: boolean;
  environment: {
    project?: string;
    python?: string;
    envFile?: string;
    model?: string;
    provider?: string;
  };
  apiKeys: KeyState[];
  authProviders: KeyState[];
  apiKeyProviders: KeyState[];
  terminal?: { backend?: string; sudo?: string };
  messaging: KeyState[];
  gateway?: { status?: string; manager?: string };
  jobs?: { active: number; total: number };
  sessions?: { active: number };
  raw: string;
  error?: string;
}

// Strip leading mojibake / box-drawing / status glyphs and whitespace from a value
function cleanVal(v: string): string {
  return v
    .replace(/^[\s\u2500-\u259F\u2700-\u27BF\u2900-\u297F\u2B00-\u2BFF\uFE00-\uFE0F]+/, '')
    .replace(/^\?+\s*/, '') // strip leading "?" mojibake
    .trim();
}

// Detect "configured / set / active / running / configured / logged in / OK"
function isConfigured(value: string): boolean {
  const v = value.toLowerCase();
  if (/\bnot\s+(set|configured|logged|installed|running)\b/.test(v)) return false;
  if (/\bnone\b/.test(v) && !/configured/.test(v)) return false;
  if (/\bstopped\b/.test(v)) return false;
  if (/\bdisabled\b/.test(v)) return false;
  if (/configured|active|running|enabled|exists|logged in|✓|ok\b/.test(v)) return true;
  // Fallback: a value that contains digits or "sk-" prefix is "set"
  if (/sk-|^\w+\.\.\.\w+/.test(value.trim())) return true;
  return false;
}

const SECTION_KEYS = [
  'Environment',
  'API Keys',
  'Auth Providers',
  'API-Key Providers',
  'Terminal Backend',
  'Messaging Platforms',
  'Gateway Service',
  'Scheduled Jobs',
  'Sessions',
];

function parseStatus(stdout: string): HermesStatus {
  const lines = stdout.split(/\r?\n/);
  const status: HermesStatus = {
    ok: true,
    environment: {},
    apiKeys: [],
    authProviders: [],
    apiKeyProviders: [],
    messaging: [],
    raw: stdout,
  };

  let section: string | null = null;

  for (const raw of lines) {
    const line = raw.replace(/\r/g, '');
    if (!line.trim()) continue;

    // Section header: a line ending in one of the known section names
    const trimmed = line.trim();
    const sectionHit = SECTION_KEYS.find((k) => trimmed.endsWith(k));
    if (sectionHit && trimmed.length - sectionHit.length <= 6) {
      section = sectionHit;
      continue;
    }

    // Key: Value lines must be indented (contain leading whitespace)
    const m = line.match(/^(\s+)([A-Za-z][\w \-/().]+?)\s{2,}(.+?)\s*$/) ||
              line.match(/^(\s+)([A-Za-z][\w \-/().]+?):\s+(.+?)\s*$/);
    if (!m) continue;
    const indent = m[1].length;
    const key = m[2].replace(/:$/, '').trim();
    const val = cleanVal(m[3]);
    // Skip nested sub-entries (>= 4-space indent) in list-style sections.
    // Top-level entries within a section use 2-space indent.
    const isNested = indent >= 4;
    if (
      isNested &&
      (section === 'Auth Providers' ||
        section === 'API-Key Providers' ||
        section === 'Messaging Platforms' ||
        section === 'API Keys')
    ) {
      continue;
    }

    switch (section) {
      case 'Environment':
        if (/^Project/i.test(key)) status.environment.project = val;
        else if (/^Python/i.test(key)) status.environment.python = val;
        else if (/^\.env/i.test(key)) status.environment.envFile = val;
        else if (/^Model/i.test(key)) status.environment.model = val;
        else if (/^Provider/i.test(key)) status.environment.provider = val;
        break;
      case 'API Keys':
        status.apiKeys.push({ name: key, configured: isConfigured(val), hint: val });
        break;
      case 'Auth Providers':
        status.authProviders.push({ name: key, configured: isConfigured(val), hint: val });
        break;
      case 'API-Key Providers':
        status.apiKeyProviders.push({ name: key, configured: isConfigured(val), hint: val });
        break;
      case 'Terminal Backend':
        if (!status.terminal) status.terminal = {};
        if (/^Backend/i.test(key)) status.terminal.backend = val;
        else if (/^Sudo/i.test(key)) status.terminal.sudo = val;
        break;
      case 'Messaging Platforms':
        status.messaging.push({ name: key, configured: isConfigured(val), hint: val });
        break;
      case 'Gateway Service':
        if (!status.gateway) status.gateway = {};
        if (/^Status/i.test(key)) status.gateway.status = val;
        else if (/^Manager/i.test(key)) status.gateway.manager = val;
        break;
      case 'Scheduled Jobs': {
        const jm = val.match(/(\d+)\s*active.*?(\d+)\s*total/i);
        if (jm) status.jobs = { active: parseInt(jm[1], 10), total: parseInt(jm[2], 10) };
        break;
      }
      case 'Sessions': {
        const sm = val.match(/(\d+)/);
        if (sm) status.sessions = { active: parseInt(sm[1], 10) };
        break;
      }
    }
  }

  return status;
}

export async function GET() {
  try {
    const { stdout, stderr, code } = await runHermes(['status'], 15000);
    if (code !== 0 && !stdout) {
      return Response.json(
        { ok: false, error: stderr || `exit ${code}`, raw: stdout },
        { status: 502 }
      );
    }
    const status = parseStatus(stdout);
    return Response.json(status);
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message || 'Failed to read status', raw: '' },
      { status: 500 }
    );
  }
}
