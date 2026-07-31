'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, BarChart3, Bot, CheckCircle2, Database, Eye, Loader2, Play, RefreshCw, Search, Trash2, Wand2, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { brandSites, growthGeo } from '../lib/api';

type Engine = {
  engine: string;
  label: string;
  region: 'cn' | 'global';
  credentialEnv: string;
  status: 'ready' | 'not-configured' | 'pending-adapter';
  provider?: string;
  baseUrl?: string;
  authConfigured?: boolean;
  note?: string;
};

type BrandOption = {
  code: string;
  label: string;
  url?: string | null;
};

type VisibilityRow = {
  engine: string;
  probes: number;
  cited: number;
  citedRate: number;
  avgAivs: number;
};

type RecentProbe = {
  id: string;
  question: string;
  engine: string;
  weCited: boolean;
  citationRank: number | null;
  competitorsCited: string[];
  probedAt: string;
  hasSnapshot: boolean;
};

type VisibilityReport = {
  visibility?: VisibilityRow[];
  recentProbes?: RecentProbe[];
  shareOfVoice?: number;
  leaderboard?: Array<{ competitor: string; cited: number }>;
  sentiment?: { positive?: number; negative?: number; neutral?: number };
  trustSources?: Array<{ domain: string; count: number; ours: boolean }>;
  hallucination?: { count?: number; samples?: Array<{ engine: string; reason: string }> };
  playbook?: Array<{ priority: string; engine?: string; kind: string; action: string }>;
  engines?: Engine[];
  onSite?: OnSiteReadiness;
  recentJobs?: ProbeJob[];
};

type ProbeJob = {
  id: string;
  question: string;
  engine: string;
  brandSlug?: string | null;
  category?: string | null;
  stage?: string | null;
  batchId?: string | null;
  questionId?: string | null;
  competitors?: string[];
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'blocked';
  errorMessage?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt?: string | null;
  probeId?: string | null;
  snapshotId?: string | null;
  aivs?: number;
  riskLevel?: 'low' | 'medium' | 'high' | string;
  riskReasons?: string[];
  answerPreview?: string | null;
  screenshotArtifactId?: string | null;
};

type ProbeDetail = {
  job: ProbeJob;
  snapshot: {
    id: string;
    answerText: string;
    citations?: Array<Record<string, unknown>>;
    rawResponse?: Record<string, unknown>;
    capturedAt?: string;
  } | null;
  probe: {
    id: string;
    engine: string;
    question: string;
    weCited: boolean;
    citationRank: number | null;
    competitorsCited?: string[];
    probedAt?: string;
  } | null;
  copyQuality?: {
    score: number;
    verdict: 'usable' | 'needs-edit' | 'blocked' | string;
    verdictLabel: string;
    summary: string;
    dimensions: Array<{
      key: string;
      label: string;
      score: number;
      status: 'good' | 'warning' | 'bad' | string;
      summary: string;
    }>;
    risks: string[];
    suggestions: string[];
    complianceFlags: string[];
  } | null;
};

type OnSiteReadiness = {
  generatedAt: string | null;
  source?: string;
  sourceTables?: string[];
  ready: number;
  total: number;
  sites: Array<Record<string, unknown>>;
};

type QuestionSet = {
  brandSlug: string | null;
  category: string;
  questions: GeoQuestion[];
  items?: GeoQuestion[];
  generated?: Array<{ stage: string; question: string }>;
};

type GeoQuestion = {
  id: string;
  brandSlug: string;
  category: string;
  stage: 'pre' | 'mid' | 'post' | 'followup';
  question: string;
  priority: number;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type ProbeBatch = {
  id: string;
  brandSlug: string;
  category: string;
  engine: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'blocked';
  totalProbes: number;
  completedProbes: number;
  citedRate: number;
  avgAivs: number;
  highRiskCount: number;
  competitorHitCount: number;
  createdAt: string;
  finishedAt?: string | null;
};

type ProbeBatchDetail = {
  batch: ProbeBatch;
  jobs: ProbeJob[];
  board?: {
    totalProbes: number;
    citedRate: number;
    avgCitationRank: number | null;
    avgAivs: number;
    competitorHitCount: number;
    highRiskCount: number;
  };
};

type Worklist = {
  brandSlug: string | null;
  category: string;
  total: number;
  items: Array<{ question: string; stage: string; engine: string; engineReady: boolean }>;
};

type ReferenceSource = {
  id: string;
  title: string;
  url: string;
  summary: string;
  owned: boolean;
};

type GeneratedOptimization = {
  kind: 'faq' | 'comparison' | 'topic';
  jobId?: string;
  title: string;
  draft: string;
  assetId?: string;
};

const stageLabels: Record<string, string> = {
  pre: '购前',
  mid: '购中',
  post: '购后',
  followup: '追问',
};

const DEFAULT_BRAND_OPTIONS: BrandOption[] = [
  { code: 'rheem', label: '瑞美 Rheem', url: 'https://www.rheem.com.cn' },
  { code: 'ruud', label: '瑞德 Ruud', url: 'https://www.ruud.com.cn' },
  { code: 'everhot', label: '恒热 Everhot', url: 'https://everhot.com.cn' },
];
const GEO_BRAND_CODES = new Set(DEFAULT_BRAND_OPTIONS.map((item) => item.code));

function normalizeGeoBrand(value: string) {
  const code = String(value || '').toLowerCase();
  return GEO_BRAND_CODES.has(code) ? code : DEFAULT_BRAND_OPTIONS[0].code;
}

function pct(value?: number) {
  return `${Math.round(Number(value || 0))}%`;
}

function fmtDate(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function splitCsv(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function cleanAnswerText(value?: string | null) {
  return String(value || '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\s+\*\*/g, ' ')
    .replace(/\*\*\s+/g, ' ')
    .trim();
}

function qualityColor(verdict: string) {
  if (verdict === 'usable') return 'var(--success)';
  if (verdict === 'blocked') return 'var(--danger)';
  return 'var(--warning)';
}

function qualityStatusColor(status: string) {
  if (status === 'good') return 'var(--success)';
  if (status === 'bad') return 'var(--danger)';
  return 'var(--warning)';
}

function normalizeQuestionKey(value?: string | null) {
  return String(value || '').replace(/\s+/g, '').trim();
}

function jobDisplayScore(job: ProbeJob) {
  const statusScore = job.status === 'succeeded' ? 3 : job.status === 'running' ? 2 : job.status === 'pending' ? 1 : 0;
  const dataScore = (job.snapshotId ? 2 : 0) + (job.probeId ? 1 : 0);
  const timeScore = new Date(job.finishedAt || job.startedAt || job.createdAt || 0).getTime() || 0;
  return statusScore * 1_000_000_000_000_000 + dataScore * 1_000_000_000_000 + timeScore;
}

function dedupeProbeJobsByQuestion(jobs: ProbeJob[]) {
  const rows = new Map<string, ProbeJob>();
  for (const job of jobs) {
    const key = normalizeQuestionKey(job.question) || job.id;
    const current = rows.get(key);
    if (!current || jobDisplayScore(job) > jobDisplayScore(current)) {
      rows.set(key, job);
    }
  }
  return Array.from(rows.values());
}

export function GrowthGeoWorkspace() {
  const [report, setReport] = useState<VisibilityReport | null>(null);
  const [engines, setEngines] = useState<Engine[]>([]);
  const [questionSet, setQuestionSet] = useState<QuestionSet | null>(null);
  const [worklist, setWorklist] = useState<Worklist | null>(null);
  const [batches, setBatches] = useState<ProbeBatch[]>([]);
  const [batchComparison, setBatchComparison] = useState<Record<string, number> | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<ProbeBatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<ProbeDetail | null>(null);
  const [streamingJob, setStreamingJob] = useState<ProbeJob | null>(null);
  const [fallbackJobId, setFallbackJobId] = useState<string | null>(null);
  const [generatingKind, setGeneratingKind] = useState<'faq' | 'comparison' | 'topic' | null>(null);
  const [generatedOptimization, setGeneratedOptimization] = useState<GeneratedOptimization | null>(null);
  const streamTextRef = useRef('');
  const streamFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [brandOptions, setBrandOptions] = useState<BrandOption[]>(DEFAULT_BRAND_OPTIONS);
  const [brandSlug, setBrandSlug] = useState(DEFAULT_BRAND_OPTIONS[0].code);
  const [category, setCategory] = useState('家用热水与舒适系统');
  const [stageFilter, setStageFilter] = useState('');
  const [questionForm, setQuestionForm] = useState({
    id: '',
    stage: 'pre' as 'pre' | 'mid' | 'post' | 'followup',
    question: '',
    priority: 100,
  });
  const [probeForm, setProbeForm] = useState({
    question: '',
    engine: 'doubao',
    competitors: '',
    answerSnapshot: '',
  });
  const [autoProbeForm, setAutoProbeForm] = useState({
    question: '家用空气能热水系统有哪些品牌值得推荐？',
    competitors: '',
  });
  const [referenceSources, setReferenceSources] = useState<ReferenceSource[]>([
    { id: 'official-site', title: '官网产品资料', url: '', summary: '', owned: true },
  ]);

  const metric = useMemo(() => {
    const rows = report?.visibility || [];
    const totalProbes = rows.reduce((sum, row) => sum + Number(row.probes || 0), 0);
    const cited = rows.reduce((sum, row) => sum + Number(row.cited || 0), 0);
    const avgAivs = rows.length
      ? Math.round(rows.reduce((sum, row) => sum + Number(row.avgAivs || 0), 0) / rows.length)
      : 0;
    return {
      totalProbes,
      citedRate: totalProbes ? Math.round((cited / totalProbes) * 100) : 0,
      shareOfVoice: report?.shareOfVoice || 0,
      avgAivs,
      hallucinationCount: report?.hallucination?.count || 0,
    };
  }, [report]);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const activeBrandSlug = normalizeGeoBrand(brandSlug);
      const [visibilityData, engineData, questions, work, batchData, siteData] = await Promise.all([
        growthGeo.visibility(),
        growthGeo.engines(),
        growthGeo.questionSet({ brandSlug: activeBrandSlug, category, ...(stageFilter ? { stage: stageFilter } : {}) }),
        growthGeo.probeWorklist({ brandSlug: activeBrandSlug, category, ...(stageFilter ? { stage: stageFilter } : {}) }),
        growthGeo.probeBatches({ brandSlug: activeBrandSlug, category }),
        brandSites.list().catch(() => null),
      ]);
      setReport(visibilityData);
      setEngines(engineData?.engines || visibilityData?.engines || []);
      const sites = Array.isArray(siteData?.items) ? siteData.items : Array.isArray(siteData) ? siteData : [];
      const nextBrandOptions = sites
        .filter((site: any) => ['rheem', 'ruud', 'everhot'].includes(String(site.code || '').toLowerCase()))
        .map((site: any) => ({
          code: String(site.code).toLowerCase(),
          label: `${site.nameCn || site.name_cn || site.nameEn || site.name_en || site.code} ${site.nameEn || site.name_en || ''}`.trim(),
          url: site.productionUrl || site.production_url || site.developmentUrl || site.development_url || null,
        }));
      if (nextBrandOptions.length) setBrandOptions(nextBrandOptions);
      if (!GEO_BRAND_CODES.has(brandSlug)) setBrandSlug(DEFAULT_BRAND_OPTIONS[0].code);
      setQuestionSet(questions);
      setWorklist(work);
      setBatches(batchData?.items || []);
      setBatchComparison(batchData?.comparison || null);
      if (batchData?.items?.[0]?.id) {
        const detail = await growthGeo.probeBatch(batchData.items[0].id);
        setSelectedBatch(detail);
      } else {
        setSelectedBatch(null);
      }
      const firstEngine = (engineData?.engines || []).find((item: Engine) => item.status === 'ready') || (engineData?.engines || [])[0];
      if (firstEngine && !probeForm.engine) {
        setProbeForm((current) => ({ ...current, engine: firstEngine.engine }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'GEO 数据加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function refreshQuestionFlow() {
    setError(null);
    try {
      const activeBrandSlug = normalizeGeoBrand(brandSlug);
      const [questions, work] = await Promise.all([
        growthGeo.questionSet({ brandSlug: activeBrandSlug, category, ...(stageFilter ? { stage: stageFilter } : {}) }),
        growthGeo.probeWorklist({ brandSlug: activeBrandSlug, category, ...(stageFilter ? { stage: stageFilter } : {}) }),
      ]);
      setQuestionSet(questions);
      setWorklist(work);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成问题集失败');
    }
  }

  async function saveGeneratedQuestions() {
    setSaving(true);
    setError(null);
    try {
      const activeBrandSlug = normalizeGeoBrand(brandSlug);
      await growthGeo.saveGeneratedQuestions({
        brandSlug: activeBrandSlug,
        category,
        questions: questionSet?.generated || [],
      });
      setNotice('推荐问题已保存到问题集。');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存推荐问题失败');
    } finally {
      setSaving(false);
    }
  }

  async function saveQuestion() {
    const question = questionForm.question.trim();
    if (!question) {
      setError('请先填写 GEO 问题');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const activeBrandSlug = normalizeGeoBrand(brandSlug);
      if (questionForm.id) {
        await growthGeo.updateQuestion(questionForm.id, {
          stage: questionForm.stage,
          question,
          priority: Number(questionForm.priority || 100),
          enabled: true,
        });
      } else {
        await growthGeo.createQuestion({
          brandSlug: activeBrandSlug,
          category,
          stage: questionForm.stage,
          question,
          priority: Number(questionForm.priority || 100),
          enabled: true,
        });
      }
      setQuestionForm({ id: '', stage: 'pre', question: '', priority: 100 });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存 GEO 问题失败');
    } finally {
      setSaving(false);
    }
  }

  async function disableQuestion(id: string) {
    setSaving(true);
    setError(null);
    try {
      await growthGeo.disableQuestion(id);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : '停用 GEO 问题失败');
    } finally {
      setSaving(false);
    }
  }

  async function removeQuestion(id: string) {
    const ok = window.confirm('确定删除这条 GEO 问题吗？历史探测结果会保留。');
    if (!ok) return;
    setSaving(true);
    setError(null);
    try {
      await growthGeo.removeQuestion(id);
      setQuestionForm((current) => current.id === id ? { id: '', stage: 'pre', question: '', priority: 100 } : current);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除 GEO 问题失败');
    } finally {
      setSaving(false);
    }
  }

  async function runBatchProbe() {
    setAutoRunning(true);
    setError(null);
    setNotice(null);
    try {
      const activeBrandSlug = normalizeGeoBrand(brandSlug);
      const selectedQuestionIds = (questionSet?.questions || [])
        .filter((item) => item.enabled)
        .map((item) => item.id);
      const result = await growthGeo.runProbeBatch({
        brandSlug: activeBrandSlug,
        category,
        ...(stageFilter ? { stage: stageFilter } : {}),
        questionIds: selectedQuestionIds,
        competitors: splitCsv(autoProbeForm.competitors),
      });
      setNotice(`批量探测已创建，共 ${result?.batch?.totalProbes || selectedQuestionIds.length} 条问题。`);
      await loadAll();
      pollBatch(result?.batch?.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '批量探测失败');
    } finally {
      setAutoRunning(false);
    }
  }

  async function openBatch(id: string) {
    setDetailLoading(true);
    setError(null);
    try {
      const detail = await growthGeo.probeBatch(id);
      setSelectedBatch(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载批次详情失败');
    } finally {
      setDetailLoading(false);
    }
  }

  function pollBatch(id?: string) {
    if (!id) return;
    let count = 0;
    const tick = async () => {
      count += 1;
      try {
        const detail = await growthGeo.probeBatch(id);
        setSelectedBatch(detail);
        const batchData = await growthGeo.probeBatches({ brandSlug: normalizeGeoBrand(brandSlug), category });
        setBatches(batchData?.items || []);
        setBatchComparison(batchData?.comparison || null);
        if (!['pending', 'running'].includes(detail?.batch?.status) || count >= 40) return;
      } catch {
        if (count >= 10) return;
      }
      window.setTimeout(tick, 3000);
    };
    window.setTimeout(tick, 1500);
  }

  async function submitProbe() {
    if (!probeForm.question.trim() || !probeForm.engine.trim()) {
      setError('请先填写探测问题和 AI 引擎');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const activeBrandSlug = normalizeGeoBrand(brandSlug);
      await growthGeo.probe({
        question: probeForm.question.trim(),
        engine: probeForm.engine.trim(),
        brandSlug: activeBrandSlug,
        competitors: splitCsv(probeForm.competitors),
        answerSnapshot: probeForm.answerSnapshot.trim() || undefined,
      });
      setProbeForm((current) => ({ ...current, question: '', answerSnapshot: '' }));
      const visibilityData = await growthGeo.visibility();
      setReport(visibilityData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存探测结果失败');
    } finally {
      setSaving(false);
    }
  }

  async function runAutoProbe() {
    if (!autoProbeForm.question.trim()) {
      setError('请先填写自动探测问题');
      return;
    }
    setAutoRunning(true);
    setError(null);
    setNotice(null);
    setFallbackJobId(null);
    streamTextRef.current = '';
    if (streamFlushTimerRef.current) {
      clearTimeout(streamFlushTimerRef.current);
      streamFlushTimerRef.current = null;
    }
    try {
      const activeBrandSlug = normalizeGeoBrand(brandSlug);
      const request = {
        question: autoProbeForm.question.trim(),
        engine: 'hermes-center-ai',
        brandSlug: activeBrandSlug,
        competitors: splitCsv(autoProbeForm.competitors),
      };
      setStreamingJob({
        id: `stream-${Date.now()}`,
        question: request.question,
        engine: request.engine,
        brandSlug: request.brandSlug,
        competitors: request.competitors,
        status: 'running',
        startedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        answerPreview: '',
      });
      setNotice('探测任务已创建，回答正在生成。');
      const flushStreamText = (force = false) => {
        if (!force && streamFlushTimerRef.current) return;
        const apply = () => {
          streamFlushTimerRef.current = null;
          const text = cleanAnswerText(streamTextRef.current);
          setStreamingJob((current) => current ? { ...current, answerPreview: text } : current);
        };
        if (force) {
          if (streamFlushTimerRef.current) {
            clearTimeout(streamFlushTimerRef.current);
            streamFlushTimerRef.current = null;
          }
          apply();
          return;
        }
        streamFlushTimerRef.current = setTimeout(apply, 120);
      };
      let streamFinished = false;
      let fallbackQueued = false;
      try {
      await growthGeo.streamProbeJob(request, (event) => {
        if (event.type === 'started' && event.job) {
          setStreamingJob((current) => ({ ...(current || event.job), ...event.job, answerPreview: current?.answerPreview || '' } as ProbeJob));
        }
        if (event.type === 'delta') {
          const content = String(event.content || '');
          streamTextRef.current += content;
          flushStreamText();
        }
        if (event.type === 'done' && event.job) {
          streamFinished = true;
          if (event.snapshot?.answerText) streamTextRef.current = String(event.snapshot.answerText);
          flushStreamText(true);
          setStreamingJob((current) => ({
            ...(current || event.job),
            ...event.job,
            status: 'succeeded',
            answerPreview: cleanAnswerText(streamTextRef.current || event.snapshot?.answerText || current?.answerPreview || ''),
          } as ProbeJob));
        }
        if ((event.type === 'failed' || event.type === 'blocked') && event.job) {
          streamFinished = true;
          setStreamingJob((current) => ({
            ...(current || event.job),
            ...event.job,
            status: event.type === 'blocked' ? 'blocked' : 'failed',
            errorMessage: String(event.errorMessage || event.job.errorMessage || '探测失败'),
          } as ProbeJob));
        }
      });
      } catch (streamErr) {
        if (!(streamErr instanceof TypeError) && !String(streamErr).includes('Failed to fetch')) throw streamErr;
        const fallback = await growthGeo.runProbeJob(request);
        const fallbackJob = fallback.job as ProbeJob;
        fallbackQueued = true;
        streamFinished = true;
        setFallbackJobId(fallbackJob.id);
        setStreamingJob((current) => ({
          ...(current || fallbackJob),
          ...fallbackJob,
          status: 'running',
          errorMessage: null,
          answerPreview: current?.answerPreview || '流式连接失败，已切换为后台生成，请稍后查看结果。',
        } as ProbeJob));
        setNotice('流式连接失败，已切换为后台生成。');
        try {
          await loadAll();
          setStreamingJob(null);
        } catch {
          // Keep the local placeholder only if the backend list cannot be refreshed.
        }
        for (let attempt = 0; attempt < 24; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          const detail = await growthGeo.probeJob(fallbackJob.id);
          const nextJob = detail.job as ProbeJob;
          const answer = cleanAnswerText(detail.snapshot?.answerText || '');
          setStreamingJob((current) => current ? ({
            ...current,
            ...nextJob,
            answerPreview: answer || current.answerPreview || '',
            errorMessage: nextJob.errorMessage || null,
          } as ProbeJob) : current);
          if (nextJob.status === 'succeeded') {
            try {
              await loadAll();
              setStreamingJob(null);
              setFallbackJobId(null);
            } catch {
              // Keep the completed fallback result visible when refresh fails.
            }
            setNotice(null);
            break;
          }
          if (nextJob.status === 'failed' || nextJob.status === 'blocked') {
            setNotice(null);
            break;
          }
        }
      }
      if (fallbackQueued) return;
      if (!streamFinished) {
        setStreamingJob((current) => current ? { ...current, status: 'failed', errorMessage: '探测连接已结束，但未收到完成结果' } : current);
        return;
      }
      try {
        await loadAll();
        setStreamingJob(null);
        setFallbackJobId(null);
      } catch {
        // Keep the streamed result visible when the follow-up refresh fails.
      }
      setNotice(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : '自动探测失败';
      setStreamingJob((current) => current ? { ...current, status: 'failed', errorMessage: message } : current);
      setError(message);
    } finally {
      if (streamFlushTimerRef.current) {
        clearTimeout(streamFlushTimerRef.current);
        streamFlushTimerRef.current = null;
      }
      setAutoRunning(false);
    }
  }

  async function openProbeDetail(job: ProbeJob) {
    setDetailLoading(true);
    setError(null);
    try {
      const detail = await growthGeo.probeJob(job.id);
      setSelectedDetail(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载探测详情失败');
    } finally {
      setDetailLoading(false);
    }
  }

  async function rerunProbe(job: ProbeJob) {
    setAutoRunning(true);
    setError(null);
    setNotice(null);
    try {
      const activeBrandSlug = normalizeGeoBrand(job.brandSlug || brandSlug);
      await growthGeo.runProbeJob({
        question: job.question,
        engine: job.engine,
        brandSlug: activeBrandSlug,
        competitors: job.competitors?.length ? job.competitors : splitCsv(autoProbeForm.competitors),
      });
      setNotice('已按原问题重新创建探测任务，任务状态会自动刷新。');
      await loadAll();
      setTimeout(() => void loadAll(), 3000);
      setTimeout(() => void loadAll(), 7000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '重新探测失败');
    } finally {
      setAutoRunning(false);
    }
  }

  function updateReferenceSource(id: string, patch: Partial<ReferenceSource>) {
    setReferenceSources((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function addReferenceSource() {
    setReferenceSources((items) => [
      ...items,
      { id: `ref-${Date.now()}`, title: '', url: '', summary: '', owned: true },
    ]);
  }

  function removeReferenceSource(id: string) {
    setReferenceSources((items) => (items.length > 1 ? items.filter((item) => item.id !== id) : items));
  }

  async function generateOptimization(
    kind: 'faq' | 'comparison' | 'topic',
    targetJob = latestProbeJob,
    targetProbe: RecentProbe | ProbeDetail['probe'] | null | undefined = latestProbe,
    answerPreview?: string | null,
  ) {
    if (!targetJob) {
      setError('请先完成一次 GEO 探测');
      return;
    }
    const detailForGaps: ProbeDetail = {
      job: targetJob,
      probe: targetProbe ? {
        id: targetProbe.id,
        engine: targetProbe.engine,
        question: targetProbe.question,
        weCited: targetProbe.weCited,
        citationRank: targetProbe.citationRank,
        competitorsCited: targetProbe.competitorsCited,
        probedAt: targetProbe.probedAt,
      } : null,
      snapshot: {
        id: targetJob.snapshotId || targetJob.id,
        answerText: answerPreview || targetJob.answerPreview || '',
        citations: referenceSources
          .filter((item) => item.url.trim())
          .map((item) => ({ title: item.title || item.url, url: item.url, owned: item.owned })),
      },
    };
    const gaps = buildContentGaps(detailForGaps, referenceSources);
    const title = kind === 'faq' ? 'FAQ 草稿' : kind === 'comparison' ? '对比文章草稿' : '专题页建议';
    const pendingText = kind === 'faq' ? '正在生成 FAQ 草稿...' : kind === 'comparison' ? '正在生成对比文章草稿...' : '正在生成专题页建议...';
    setGeneratingKind(kind);
    setGeneratedOptimization({ kind, jobId: targetJob.id, title, draft: pendingText });
    setError(null);
    setNotice(null);
    try {
      let draft = '';
      let finalAssetId: string | undefined;
      const payload = {
        kind,
        probeJobId: targetJob.id,
        question: targetJob.question,
        answerPreview: answerPreview || targetJob.answerPreview || undefined,
        brandSlug: normalizeGeoBrand(targetJob.brandSlug || brandSlug),
        category: targetJob.category || category,
        competitors: targetProbe?.competitorsCited?.length ? targetProbe.competitorsCited : targetJob.competitors,
        contentGaps: gaps,
        sources: referenceSources.filter((item) => item.title.trim() || item.url.trim() || item.summary.trim()),
      };
      let allowFallback = true;
      try {
        await growthGeo.streamOptimizationContent(payload,
        (event) => {
          if (event.type === 'delta' && typeof event.content === 'string') {
            draft += event.content;
            setGeneratedOptimization({ kind, jobId: targetJob.id, title, draft });
          }
          if (event.type === 'done') {
            const finalDraft = String(event.draft || draft || '');
            draft = finalDraft;
            finalAssetId = event.asset?.id;
            setGeneratedOptimization({
              kind,
              jobId: targetJob.id,
              title,
              draft: finalDraft,
              assetId: finalAssetId,
            });
          }
          if (event.type === 'failed') {
            allowFallback = false;
            throw new Error(String(event.error || '生成优化内容失败'));
          }
        },
        );
      } catch (streamErr) {
        const streamMessage = streamErr instanceof Error ? streamErr.message : String(streamErr);
        if (!allowFallback || (!streamMessage.includes('Failed to fetch') && !streamMessage.includes('流式'))) {
          throw streamErr;
        }
        const fallback = await growthGeo.optimizationContent(payload);
        draft = String(fallback?.draft || fallback?.asset?.draft || '');
        finalAssetId = fallback?.asset?.id;
        setGeneratedOptimization({
          kind,
          jobId: targetJob.id,
          title,
          draft,
          assetId: finalAssetId,
        });
      }
      setGeneratedOptimization({
        kind,
        jobId: targetJob.id,
        title: kind === 'faq' ? 'FAQ 草稿' : kind === 'comparison' ? '对比文章草稿' : '专题页建议',
        draft,
        assetId: finalAssetId,
      });
      setNotice('优化内容已生成，并保存为草稿。');
    } catch (err) {
      const message = err instanceof Error ? err.message : '生成优化内容失败';
      setGeneratedOptimization({ kind, jobId: targetJob.id, title, draft: `生成失败：${message}` });
      setError(message);
    } finally {
      setGeneratingKind(null);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (!report?.recentJobs?.some((job) => job.status === 'running')) return;
    const timer = window.setTimeout(() => void loadAll(), 3000);
    return () => window.clearTimeout(timer);
  }, [report?.recentJobs]);

  useEffect(() => {
    const batch = selectedBatch?.batch;
    if (!batch || !['pending', 'running'].includes(batch.status)) return;
    const timer = window.setTimeout(() => {
      void openBatch(batch.id);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [selectedBatch?.batch?.id, selectedBatch?.batch?.status, selectedBatch?.batch?.completedProbes]);

  useEffect(() => {
    if (!streamingJob) return;
    const backendJob = report?.recentJobs?.find((job) => {
      if (fallbackJobId && job.id === fallbackJobId) return true;
      if (!streamingJob.id.startsWith('stream-') && job.id === streamingJob.id) return true;
      return job.question === streamingJob.question
        && job.engine === streamingJob.engine
        && new Date(job.createdAt || 0).getTime() >= new Date(streamingJob.createdAt || 0).getTime();
    });
    if (!backendJob) return;
    if (backendJob.status === 'succeeded' || backendJob.status === 'failed' || backendJob.status === 'blocked') {
      setStreamingJob(null);
      setFallbackJobId(null);
      setNotice(null);
    }
  }, [fallbackJobId, report?.recentJobs, streamingJob]);

  useEffect(() => () => {
    if (streamFlushTimerRef.current) {
      clearTimeout(streamFlushTimerRef.current);
      streamFlushTimerRef.current = null;
    }
  }, []);

  const recent = report?.recentProbes || [];
  const recentJobs = report?.recentJobs || [];
  const batchJobs = selectedBatch?.jobs || [];
  const dedupedBatchJobs = useMemo(() => dedupeProbeJobsByQuestion(batchJobs), [batchJobs]);
  const realProbeJobs = recentJobs.filter((job) => job.engine !== 'mock');
  const backendStreamingJob = streamingJob
    ? realProbeJobs.find((job) => {
      if (fallbackJobId && job.id === fallbackJobId) return true;
      if (!streamingJob.id.startsWith('stream-') && job.id === streamingJob.id) return true;
      return job.question === streamingJob.question
        && job.engine === streamingJob.engine
        && new Date(job.createdAt || 0).getTime() >= new Date(streamingJob.createdAt || 0).getTime();
    })
    : null;
  const latestProbeJob = backendStreamingJob || streamingJob || realProbeJobs[0] || null;
  const latestProbe = latestProbeJob
    && !latestProbeJob.id.startsWith('stream-')
    ? recent.find((item) => item.id === latestProbeJob.probeId || (item.question === latestProbeJob.question && item.engine === latestProbeJob.engine))
    : null;
  const failedProbeJobs = realProbeJobs.filter((job) => ['failed', 'blocked'].includes(job.status));
  const visibilityByEngine = new Map((report?.visibility || []).map((item) => [item.engine, item]));
  const latestEngineVisibility = latestProbeJob ? visibilityByEngine.get(latestProbeJob.engine) : undefined;
  const latestDetailForSuggestions: ProbeDetail | null = latestProbeJob ? {
    job: latestProbeJob,
    probe: latestProbe ? {
      id: latestProbe.id,
      engine: latestProbe.engine,
      question: latestProbe.question,
      weCited: latestProbe.weCited,
      citationRank: latestProbe.citationRank,
      competitorsCited: latestProbe.competitorsCited,
      probedAt: latestProbe.probedAt,
    } : null,
    snapshot: latestProbeJob.answerPreview ? {
      id: latestProbeJob.snapshotId || latestProbeJob.id,
      answerText: latestProbeJob.answerPreview,
      citations: referenceSources
        .filter((item) => item.url.trim())
        .map((item) => ({ title: item.title || item.url, url: item.url, owned: item.owned })),
    } : null,
  } : null;
  const contentGaps = latestDetailForSuggestions ? buildContentGaps(latestDetailForSuggestions, referenceSources) : [];
  const nextActions = latestDetailForSuggestions ? buildNextActions(latestDetailForSuggestions) : [];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section className="card-elevated" style={{ padding: 18, display: 'grid', gap: 14 }}>
        <div className="workbench-section-header">
          <div>
            <p className="workbench-section-header__eyebrow">GEO 总览</p>
            <h2 className="workbench-section-header__title">AI 品牌可见度</h2>
            <p className="workbench-section-header__description">统一查看品牌出现率、声量占比、AIVS、风险和 AI 引擎覆盖。</p>
          </div>
          <button className="btn btn-outline btn-sm" type="button" onClick={loadAll} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            刷新
          </button>
        </div>
        {error ? (
          <div className="inset" style={{ color: 'var(--danger)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <AlertCircle size={16} />
            {error}
          </div>
        ) : null}
        {notice ? <div className="inset" style={{ color: 'var(--success)', fontSize: 13 }}>{notice}</div> : null}
        <div className="g4" style={{ gap: 12 }}>
          <MetricCard icon={Database} label="累计探测" value={String(metric.totalProbes)} hint="已完成的有效探测" />
          <MetricCard icon={Search} label="我方出现率" value={pct(metric.citedRate)} hint="AI 回答中出现我方品牌" />
          <MetricCard icon={Bot} label="平均 AIVS" value={String(metric.avgAivs)} hint="AI 可见度评分" />
          <MetricCard icon={BarChart3} label="声量占比" value={pct(metric.shareOfVoice)} hint="我方与竞品声量比" />
          <MetricCard icon={AlertCircle} label="高风险问题" value={String(selectedBatch?.board?.highRiskCount || selectedBatch?.batch?.highRiskCount || metric.hallucinationCount || 0)} hint="未出现、竞品独占或事实风险" />
          <MetricCard icon={Database} label="覆盖入口" value={String(engines.length || 0)} hint="已纳入监测范围的 AI 引擎" />
        </div>
        <div className="table-shell">
          <table className="table">
            <thead><tr><th>AI 引擎</th><th>探测数</th><th>被引用</th><th>引用率</th><th>平均 AIVS</th></tr></thead>
            <tbody>
              {(report?.visibility || []).map((item) => (
                <tr key={item.engine}>
                  <td style={{ fontWeight: 700 }}>{engineLabel(engines, item.engine)}</td>
                  <td>{item.probes}</td>
                  <td>{item.cited}</td>
                  <td>{pct(item.citedRate)}</td>
                  <td>{item.avgAivs}</td>
                </tr>
              ))}
              {!report?.visibility?.length ? <EmptyRow colSpan={5} text={loading ? '正在加载可见度数据' : '暂无可见度数据'} /> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card-elevated" style={{ padding: 18, display: 'grid', gap: 14 }}>
        <div className="workbench-section-header">
          <div>
            <p className="workbench-section-header__eyebrow">问题池</p>
            <h2 className="workbench-section-header__title">GEO 问题池与探测任务</h2>
            <p className="workbench-section-header__description">统一维护监测问题、推荐问题、手动回答和 Hermes 批量探测。</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-outline btn-sm" type="button" onClick={refreshQuestionFlow} disabled={saving || loading}><Play size={14} />生成推荐问题</button>
            <button className="btn btn-outline btn-sm" type="button" onClick={saveGeneratedQuestions} disabled={saving || !(questionSet?.generated || []).length}><CheckCircle2 size={14} />保存推荐</button>
            <button className="btn btn-brand btn-sm" type="button" onClick={runBatchProbe} disabled={autoRunning || !(questionSet?.questions || []).length}>{autoRunning ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}Hermes 批量探测</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}><span className="t-label">品牌官网</span><select className="input" value={brandSlug} onChange={(event) => setBrandSlug(normalizeGeoBrand(event.target.value))}>{brandOptions.map((item) => (<option key={item.code} value={item.code}>{item.label}</option>))}</select></label>
          <label style={{ display: 'grid', gap: 6 }}><span className="t-label">品类</span><input className="input" value={category} onChange={(event) => setCategory(event.target.value)} /></label>
          <label style={{ display: 'grid', gap: 6 }}><span className="t-label">阶段</span><select className="input" value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}><option value="">全部阶段</option><option value="pre">购前</option><option value="mid">购中</option><option value="post">购后</option><option value="followup">追问</option></select></label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '140px minmax(0, 1fr) 110px 160px', gap: 10 }}>
          <select className="input" value={questionForm.stage} onChange={(event) => setQuestionForm((current) => ({ ...current, stage: event.target.value as any }))}><option value="pre">购前</option><option value="mid">购中</option><option value="post">购后</option><option value="followup">追问</option></select>
          <input className="input" placeholder="新增或编辑 GEO 问题" value={questionForm.question} onChange={(event) => setQuestionForm((current) => ({ ...current, question: event.target.value }))} />
          <input className="input" type="number" value={questionForm.priority} onChange={(event) => setQuestionForm((current) => ({ ...current, priority: Number(event.target.value || 100) }))} />
          <button className="btn btn-brand btn-sm" type="button" onClick={saveQuestion} disabled={saving}>{questionForm.id ? '保存编辑' : '新增问题'}</button>
        </div>
        <div className="table-shell growth-geo-questions-table-shell">
          <table className="table growth-geo-questions-table">
            <thead><tr><th>阶段</th><th>探测问题</th><th>优先级</th><th>状态</th><th style={{ minWidth: 220, whiteSpace: 'nowrap' }}>操作</th></tr></thead>
            <tbody>
              {(questionSet?.questions || []).slice(0, 20).map((item) => (
                <tr key={item.id || item.stage + '-' + item.question}>
                  <td><span className="badge">{stageLabels[item.stage] || item.stage}</span></td>
                  <td style={{ fontWeight: 700 }}>{item.question}</td>
                  <td>{item.priority}</td>
                  <td><span className="badge">{item.enabled ? '启用' : '停用'}</span></td>
                  <td style={{ minWidth: 220 }}><div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', alignItems: 'center', justifyContent: 'center' }}><button className="btn btn-outline btn-sm" type="button" onClick={() => setQuestionForm({ id: item.id, stage: item.stage, question: item.question, priority: item.priority })}>编辑</button><button className="btn btn-outline btn-sm" type="button" onClick={() => disableQuestion(item.id)} disabled={!item.enabled || saving}>停用</button><button className="btn btn-outline btn-sm" type="button" onClick={() => removeQuestion(item.id)} disabled={saving}><Trash2 size={14} />删除</button></div></td>
                </tr>
              ))}
              {!questionSet?.questions?.length ? <EmptyRow colSpan={5} text={loading ? '正在加载问题池' : '暂无问题，请先新增或生成推荐问题'} /> : null}
            </tbody>
          </table>
        </div>
        {(questionSet?.generated || []).length ? (
          <details className="inset"><summary style={{ cursor: 'pointer', color: 'var(--t-secondary)', fontSize: 13, fontWeight: 700 }}>待保存推荐问题（{questionSet?.generated?.length || 0}）</summary><div className="table-shell" style={{ marginTop: 10 }}><table className="table"><thead><tr><th>阶段</th><th>推荐问题</th></tr></thead><tbody>{(questionSet?.generated || []).map((item, index) => (<tr key={item.stage + '-' + item.question + '-' + index}><td><span className="badge">{stageLabels[item.stage] || item.stage}</span></td><td style={{ fontWeight: 700 }}>{item.question}</td></tr>))}</tbody></table></div></details>
        ) : null}
        <details className="inset">
          <summary style={{ cursor: 'pointer', color: 'var(--t-secondary)', fontSize: 13, fontWeight: 700 }}>即时探测与手动补录</summary>
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            <div className="workbench-section-header"><div><h3 className="workbench-section-header__title" style={{ fontSize: 16 }}>真实模型探测</h3><p className="workbench-section-header__description">输入目标问题，查看品牌露出、引用位次和竞品占位。</p></div><button className="btn btn-brand btn-sm" type="button" onClick={runAutoProbe} disabled={autoRunning}>{autoRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}创建探测任务</button></div>
            <input className="input" value={autoProbeForm.question} onChange={(event) => setAutoProbeForm((current) => ({ ...current, question: event.target.value }))} placeholder="输入要询问模型的 GEO 问题" />
            <input className="input" value={autoProbeForm.competitors} onChange={(event) => setAutoProbeForm((current) => ({ ...current, competitors: event.target.value }))} placeholder="竞品名称，用逗号分隔" />
            <LatestProbeCard job={latestProbeJob} probe={latestProbe} engines={engines} loading={loading} detailLoading={detailLoading} autoRunning={autoRunning} onDetail={openProbeDetail} onRerun={rerunProbe} onGenerate={(job, probe) => generateOptimization('comparison', job, probe, job.answerPreview)} generating={Boolean(generatingKind)} generatedOptimization={generatedOptimization} />
            <div style={{ display: 'grid', gap: 10, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              <strong style={{ color: 'var(--t-primary)' }}>手动补录 AI 回答</strong>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 180px', gap: 12 }}><input className="input" placeholder="Example: Which home heat pump water heater brands are worth recommending?" value={probeForm.question} onChange={(event) => setProbeForm((current) => ({ ...current, question: event.target.value }))} /><select className="input" value={probeForm.engine} onChange={(event) => setProbeForm((current) => ({ ...current, engine: event.target.value }))}>{engines.map((item) => (<option key={item.engine} value={item.engine}>{item.label || item.engine}</option>))}</select></div>
              <input className="input" placeholder="竞品名称，用逗号分隔" value={probeForm.competitors} onChange={(event) => setProbeForm((current) => ({ ...current, competitors: event.target.value }))} />
              <textarea className="input" rows={4} placeholder="粘贴真实 AI 回答。没有回答时也可以先保存问题和引擎。" value={probeForm.answerSnapshot} onChange={(event) => setProbeForm((current) => ({ ...current, answerSnapshot: event.target.value }))} style={{ resize: 'vertical' }} />
              <div><button className="btn btn-brand btn-sm" type="button" onClick={submitProbe} disabled={saving}>{saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}保存探测</button></div>
            </div>
          </div>
        </details>
        <p style={{ color: 'var(--t-tertiary)', fontSize: 12 }}>当前可探测问题：{worklist?.total || 0} 条，真实运行引擎固定为 Hermes 中心 AI。</p>
      </section>

      <section className="card-elevated" style={{ padding: 18, display: 'grid', gap: 14 }}>
        <div className="workbench-section-header"><div><p className="workbench-section-header__eyebrow">结果诊断</p><h2 className="workbench-section-header__title">探测结果诊断</h2><p className="workbench-section-header__description">统一查看批量、即时和历史探测结果；内容补缺从详情进入。</p></div><button className="btn btn-outline btn-sm" type="button" onClick={loadAll} disabled={loading}>{loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}刷新</button></div>
        {selectedBatch?.batch && ['pending', 'running'].includes(selectedBatch.batch.status) ? <div className="inset" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, color: 'var(--t-secondary)' }}><span>Hermes 批量探测进行中：{selectedBatch.batch.completedProbes || 0}/{selectedBatch.batch.totalProbes || 0}</span><Loader2 size={16} className="animate-spin" /></div> : null}
        {batchComparison ? <div className="inset" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}><MetricCard icon={BarChart3} label="出现率变化" value={(Number(batchComparison.citedRateDelta || 0) > 0 ? '+' : '') + (batchComparison.citedRateDelta || 0) + '%'} hint="最近两次批次对比" /><MetricCard icon={Bot} label="AIVS 变化" value={(Number(batchComparison.avgAivsDelta || 0) > 0 ? '+' : '') + (batchComparison.avgAivsDelta || 0)} hint="最近两次批次对比" /><MetricCard icon={AlertCircle} label="高风险变化" value={(Number(batchComparison.highRiskDelta || 0) > 0 ? '+' : '') + (batchComparison.highRiskDelta || 0)} hint="负数代表风险下降" /><MetricCard icon={Database} label="竞品命中变化" value={(Number(batchComparison.competitorHitDelta || 0) > 0 ? '+' : '') + (batchComparison.competitorHitDelta || 0)} hint="最近两次批次对比" /></div> : null}
        <div className="table-shell growth-geo-results-table-shell"><table className="table growth-geo-results-table"><thead><tr><th>问题</th><th>阶段</th><th>AI 引擎</th><th>我方出现</th><th>AIVS</th><th>竞品命中</th><th>状态</th><th>风险</th><th>操作</th></tr></thead><tbody>{dedupedBatchJobs.map((job) => (<tr key={job.id}><td style={{ fontWeight: 700 }}>{job.question}</td><td><span className="badge">{job.stage ? stageLabels[job.stage] || job.stage : '-'}</span></td><td>{engineLabel(engines, job.engine)}</td><td>{job.probeId && job.riskReasons?.includes('we-cited') ? '是' : job.status === 'succeeded' ? '否' : '-'}</td><td>{job.aivs || 0}</td><td>{(job as any).probe?.competitorsCited?.length ? (job as any).probe.competitorsCited.join('、') : '-'}</td><td><span className="badge">{statusLabel(job.status)}</span></td><td><span className="badge">{riskLabel(job.riskLevel)}</span></td><td><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="btn btn-outline btn-sm" type="button" onClick={() => openProbeDetail(job)} disabled={!job.snapshotId || detailLoading}>详情</button><button className="btn btn-outline btn-sm" type="button" onClick={() => rerunProbe(job)} disabled={autoRunning || ['pending', 'running'].includes(job.status)}>重探</button><button className="btn btn-outline btn-sm" type="button" onClick={() => generateOptimization('faq', job, (job as any).probe, job.answerPreview)} disabled={job.status !== 'succeeded' || Boolean(generatingKind)}>生成建议</button></div></td></tr>))}{!dedupedBatchJobs.length ? <EmptyRow colSpan={9} text={loading ? '正在加载探测结果' : '暂无探测结果'} /> : null}</tbody></table></div>
        {batches.length ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{batches.slice(0, 6).map((batch) => (<button key={batch.id} className="btn btn-outline btn-sm" type="button" onClick={() => openBatch(batch.id)}>{fmtDate(batch.createdAt)} · {statusLabel(batch.status)} · {pct(batch.citedRate)}</button>))}</div> : null}
        {realProbeJobs.length ? <details className="inset"><summary style={{ cursor: 'pointer', color: 'var(--t-secondary)', fontSize: 13, fontWeight: 700 }}>即时与历史探测记录（{realProbeJobs.length}）</summary><div className="table-shell" style={{ marginTop: 10 }}><table className="table"><thead><tr><th>问题</th><th>引擎</th><th>状态</th><th>摘要 / 错误</th><th>时间</th><th>操作</th></tr></thead><tbody>{realProbeJobs.slice(0, 21).map((job) => (<tr key={job.id}><td style={{ fontWeight: 700 }}>{job.question}</td><td>{engineLabel(engines, job.engine)}</td><td><span className="badge">{statusLabel(job.status)}</span></td><td>{job.answerPreview || job.errorMessage || '-'}</td><td>{fmtDate(job.finishedAt || job.createdAt)}</td><td><button className="btn btn-outline btn-sm" type="button" onClick={() => openProbeDetail(job)} disabled={detailLoading || !job.snapshotId}><Eye size={14} />详情</button></td></tr>))}</tbody></table></div></details> : null}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 380px)', gap: 16 }}>
        <section className="card-elevated" style={{ padding: 18, display: 'grid', gap: 12 }}><div className="workbench-section-header"><div><p className="workbench-section-header__eyebrow">优化任务</p><h2 className="workbench-section-header__title">优化建议</h2></div></div>{(report?.playbook || []).map((item) => (<div key={item.priority + '-' + item.kind + '-' + item.action} className="inset" style={{ display: 'grid', gap: 6 }}><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span className="badge">{item.priority}</span><strong style={{ color: 'var(--t-primary)', fontSize: 13 }}>{item.engine || item.kind}</strong></div><p style={{ color: 'var(--t-secondary)', fontSize: 13 }}>{item.action}</p></div>))}{!report?.playbook?.length ? <p style={{ color: 'var(--t-tertiary)', fontSize: 13 }}>暂无优化任务。</p> : null}</section>
        <section className="card-elevated" style={{ padding: 18, display: 'grid', gap: 12 }}><div className="workbench-section-header"><div><p className="workbench-section-header__eyebrow">站内可引用度</p><h2 className="workbench-section-header__title">Guard GEO 报告</h2></div></div><div className="inset"><div className="t-label">就绪站点</div><div style={{ marginTop: 6, fontSize: 28, fontWeight: 800, color: 'var(--brand)', fontVariantNumeric: 'tabular-nums' }}>{report?.onSite?.ready || 0}/{report?.onSite?.total || 0}</div><p style={{ marginTop: 6, color: 'var(--t-tertiary)', fontSize: 12 }}>查询时间：{report?.onSite?.generatedAt ? fmtDate(report.onSite.generatedAt) : '-'}{report?.onSite?.sourceTables?.length ? ' · ' + report.onSite.sourceTables.join(' / ') : ''}</p></div><div className="table-shell"><table className="table"><thead><tr><th>站点</th><th>已发布产品</th><th>状态</th></tr></thead><tbody>{(report?.onSite?.sites || []).slice(0, 6).map((site, index) => (<tr key={String(site.site || site.url || index)}><td style={{ fontWeight: 700 }}>{String(site.siteName || site.siteCode || site.url || site.name || '-')}</td><td>{String(site.publishedProducts || 0)}</td><td>{String(site.status || '-')}</td></tr>))}{!report?.onSite?.sites?.length ? <EmptyRow colSpan={3} text="暂无站内数据" /> : null}</tbody></table></div></section>
      </div>

      {selectedDetail ? <ProbeDetailModal detail={selectedDetail} engines={engines} engineAivs={visibilityByEngine.get(selectedDetail.job.engine)?.avgAivs} onClose={() => setSelectedDetail(null)} onRerun={() => rerunProbe(selectedDetail.job)} onGenerate={(kind) => generateOptimization(kind, selectedDetail.job, selectedDetail.probe, selectedDetail.snapshot?.answerText)} generatingKind={generatingKind} generatedOptimization={generatedOptimization} /> : null}
    </div>
  );
}
function ProbeDetailModal({
  detail,
  engines,
  engineAivs,
  onClose,
  onRerun,
  onGenerate,
  generatingKind,
  generatedOptimization,
}: {
  detail: ProbeDetail;
  engines: Engine[];
  engineAivs?: number;
  onClose: () => void;
  onRerun: () => void;
  onGenerate: (kind: 'faq' | 'comparison' | 'topic') => void;
  generatingKind: 'faq' | 'comparison' | 'topic' | null;
  generatedOptimization: GeneratedOptimization | null;
}) {
  const job = detail.job;
  const probe = detail.probe;
  const snapshot = detail.snapshot;
  const copyQuality = detail.copyQuality;
  const suggestions = buildGeoSuggestions(detail);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(15, 23, 42, 0.36)', display: 'grid', placeItems: 'center', padding: 24 }}>
      <section className="card-elevated" style={{ width: 'min(960px, 96vw)', maxHeight: '88vh', overflow: 'auto', padding: 18, display: 'grid', gap: 14 }}>
        <div className="workbench-section-header">
          <div>
            <p className="workbench-section-header__eyebrow">探测详情</p>
            <h2 className="workbench-section-header__title">{job.question}</h2>
            <p className="workbench-section-header__description">
              {engineLabel(engines, job.engine)} · {job.status} · {fmtDate(job.finishedAt || job.createdAt)}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline btn-sm" type="button" onClick={onRerun}>
              <RefreshCw size={14} />
              重新探测
            </button>
            <button className="btn btn-outline btn-sm" type="button" onClick={onClose} aria-label="关闭">
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="g4" style={{ gap: 12 }}>
          <MetricCard icon={Search} label="我方出现" value={probe?.weCited ? '是' : '否'} hint="品牌名或我方域名命中" />
          <MetricCard icon={BarChart3} label="引用位次" value={probe?.citationRank ? String(probe.citationRank) : '-'} hint="答案句段中的首次位置" />
          <MetricCard icon={Bot} label="AIVS" value={engineAivs !== undefined ? String(engineAivs) : '-'} hint="当前引擎平均分" />
          <MetricCard icon={Database} label="文案质量" value={copyQuality ? String(copyQuality.score) : '-'} hint={copyQuality?.verdictLabel || engineLabel(engines, job.engine)} />
        </div>

        {job.errorMessage ? (
          <div className="inset" style={{ color: 'var(--danger)', display: 'grid', gap: 4 }}>
            <strong>失败原因</strong>
            <span>{job.errorMessage}</span>
          </div>
        ) : null}

        {copyQuality ? (
          <div className="inset" style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'grid', gap: 4 }}>
                <strong style={{ color: 'var(--t-primary)' }}>文案风格质量</strong>
                <p style={{ color: 'var(--t-secondary)', fontSize: 13 }}>{copyQuality.summary}</p>
              </div>
              <span className="badge" style={{ color: qualityColor(copyQuality.verdict), borderColor: qualityColor(copyQuality.verdict) }}>
                {copyQuality.verdictLabel}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
              {copyQuality.dimensions.map((item) => (
                <div key={item.key} className="inset" style={{ display: 'grid', gap: 6, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <strong style={{ color: 'var(--t-primary)', fontSize: 13 }}>{item.label}</strong>
                    <span style={{ color: qualityStatusColor(item.status), fontWeight: 800 }}>{item.score}</span>
                  </div>
                  <p style={{ color: 'var(--t-tertiary)', fontSize: 12, lineHeight: 1.5 }}>{item.summary}</p>
                </div>
              ))}
            </div>
            {copyQuality.risks.length ? (
              <div style={{ display: 'grid', gap: 6 }}>
                <strong style={{ color: 'var(--danger)', fontSize: 13 }}>主要风险</strong>
                {copyQuality.risks.map((item) => (
                  <p key={item} style={{ color: 'var(--t-secondary)', fontSize: 13 }}>{item}</p>
                ))}
              </div>
            ) : null}
            {copyQuality.suggestions.length ? (
              <div style={{ display: 'grid', gap: 6 }}>
                <strong style={{ color: 'var(--t-primary)', fontSize: 13 }}>修改建议</strong>
                {copyQuality.suggestions.map((item) => (
                  <p key={item} style={{ color: 'var(--t-secondary)', fontSize: 13 }}>{item}</p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="inset" style={{ display: 'grid', gap: 8 }}>
          <strong style={{ color: 'var(--t-primary)' }}>完整 AI 回答</strong>
          <p style={{ whiteSpace: 'pre-wrap', color: 'var(--t-secondary)', lineHeight: 1.7, fontSize: 13 }}>
            {snapshot?.answerText || '暂无回答'}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
          <div className="inset" style={{ display: 'grid', gap: 8 }}>
            <strong style={{ color: 'var(--t-primary)' }}>竞品占位</strong>
            <p style={{ color: 'var(--t-secondary)', fontSize: 13 }}>
              {probe?.competitorsCited?.length ? probe.competitorsCited.join('、') : '本次回答未命中已配置竞品。'}
            </p>
          </div>
          <div className="inset" style={{ display: 'grid', gap: 8 }}>
            <strong style={{ color: 'var(--t-primary)' }}>引用链接</strong>
            {(snapshot?.citations || []).length ? (
              <div style={{ display: 'grid', gap: 6 }}>
                {(snapshot?.citations || []).slice(0, 8).map((item, index) => (
                  <span key={`${String(item.url || index)}`} style={{ color: 'var(--t-secondary)', fontSize: 13 }}>
                    {String(item.title || item.domain || item.url || '-')}
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--t-secondary)', fontSize: 13 }}>暂无引用链接。</p>
            )}
          </div>
        </div>

        <div className="inset" style={{ display: 'grid', gap: 8 }}>
          <strong style={{ color: 'var(--t-primary)' }}>优化建议</strong>
          {suggestions.map((item) => (
            <p key={item} style={{ color: 'var(--t-secondary)', fontSize: 13 }}>{item}</p>
          ))}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            <button className="btn btn-outline btn-sm" type="button" onClick={() => onGenerate('faq')} disabled={Boolean(generatingKind)}>
              {generatingKind === 'faq' ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              生成 FAQ
            </button>
            <button className="btn btn-outline btn-sm" type="button" onClick={() => onGenerate('comparison')} disabled={Boolean(generatingKind)}>
              {generatingKind === 'comparison' ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              生成对比文章
            </button>
            <button className="btn btn-outline btn-sm" type="button" onClick={() => onGenerate('topic')} disabled={Boolean(generatingKind)}>
              {generatingKind === 'topic' ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              生成专题页建议
            </button>
          </div>
        </div>

        {generatedOptimization ? (
          <div className="inset" style={{ display: 'grid', gap: 8 }}>
            <strong style={{ color: 'var(--t-primary)' }}>{generatedOptimization.title}</strong>
            <p style={{ color: 'var(--t-secondary)', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {cleanAnswerText(generatedOptimization.draft)}
            </p>
            {generatedOptimization.assetId ? (
              <p style={{ color: 'var(--t-tertiary)', fontSize: 12 }}>已保存为草稿。</p>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function buildGeoSuggestions(detail: ProbeDetail) {
  const probe = detail.probe;
  const items: string[] = [];
  if (!probe?.weCited) {
    items.push('补齐权威内容：围绕该问题生成 FAQ、选购指南或产品对比页，并把品牌名、产品能力和服务承诺写进页面主内容。');
  } else if (probe.citationRank && probe.citationRank > 2) {
    items.push('提升引用位次：把该问题对应的答案前置到官网专题页、FAQ 和结构化数据中，增强首段品牌露出。');
  } else {
    items.push('保持优势：本次回答已命中我方品牌，可继续沉淀为标准问答和官网 FAQ。');
  }
  if (probe?.competitorsCited?.length) {
    items.push(`增加对比内容：本次竞品占位包含 ${probe.competitorsCited.join('、')}，建议生成“我方方案 vs 主流品牌”的对比素材。`);
  }
  if (!detail.snapshot?.citations?.length) {
    items.push('补来源链路：建议整理官网资料、产品资料和案例链接，让后续回答更容易引用我方权威内容。');
  }
  return items;
}

function buildContentGaps(detail: ProbeDetail, sources: ReferenceSource[]) {
  const probe = detail.probe;
  const ownedSources = sources.filter((item) => item.owned && (item.url.trim() || item.summary.trim()));
  const gaps: Array<{ level: 'P0' | 'P1' | 'P2'; title: string; desc: string }> = [];
  if (!probe?.weCited) {
    gaps.push({
      level: 'P0',
      title: '品牌未进入回答',
      desc: '当前问题下 AI 回答没有形成我方品牌露出，应补充该问题对应的权威答案页、FAQ 或产品专题。',
    });
  } else if (probe.citationRank && probe.citationRank > 2) {
    gaps.push({
      level: 'P1',
      title: '引用位次偏后',
      desc: '我方已出现但位置不靠前，应把核心回答、品牌名和服务优势前置到页面首段与结构化问答中。',
    });
  }
  if (probe?.competitorsCited?.length) {
    gaps.push({
      level: 'P1',
      title: '竞品占位明显',
      desc: `本次回答提到 ${probe.competitorsCited.join('、')}，建议补充对比内容，说明我方适用场景、服务能力和差异化价值。`,
    });
  }
  if (!ownedSources.length) {
    gaps.push({
      level: 'P1',
      title: '缺少我方权威来源',
      desc: '建议添加官网、产品页、案例或 FAQ 链接，作为后续生成内容和引用来源的依据。',
    });
  }
  if (!detail.snapshot?.citations?.length) {
    gaps.push({
      level: 'P2',
      title: '引用来源不足',
      desc: '当前回答没有稳定引用链接，后续应把参考资料整理成可引用内容并同步到对外站点。',
    });
  }
  return gaps.length ? gaps : [{
    level: 'P2' as const,
    title: '持续巩固内容',
    desc: '本次结果较稳定，可把回答沉淀为 FAQ、选购指南和专题页内容，继续复测排名变化。',
  }];
}

function buildNextActions(detail: ProbeDetail) {
  const competitorText = detail.probe?.competitorsCited?.length ? detail.probe.competitorsCited.join('、') : '主流竞品';
  return [
    {
      kind: 'faq' as const,
      title: '生成 FAQ',
    },
    {
      kind: 'comparison' as const,
      title: '生成对比文章',
      helper: `重点对比 ${competitorText} 与我方方案差异。`,
    },
    {
      kind: 'topic' as const,
      title: '生成专题页建议',
    },
  ];
}

function statusLabel(status: ProbeJob['status']) {
  const labels: Record<ProbeJob['status'], string> = {
    pending: '待执行',
    running: '运行中',
    succeeded: '成功',
    failed: '失败',
    blocked: '已阻断',
  };
  return labels[status] || status;
}

function riskLabel(value?: ProbeJob['riskLevel'] | null) {
  if (value === 'high') return '高';
  if (value === 'medium') return '中';
  if (value === 'low') return '低';
  return value || '-';
}

function MetricCard({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: string; hint: string }) {
  return (
    <article className="inset" style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span className="t-label">{label}</span>
        <Icon size={16} style={{ color: 'var(--brand)' }} />
      </div>
      <div style={{ marginTop: 8, fontSize: 28, lineHeight: 1, fontWeight: 800, color: 'var(--t-strong)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <p style={{ marginTop: 8, color: 'var(--t-tertiary)', fontSize: 12 }}>{hint}</p>
    </article>
  );
}

function engineDisplayName(engine: string) {
  return engine === 'hermes-center-ai' ? '中心 AI' : engine;
}

function LatestProbeCard({
  job,
  probe,
  engines,
  loading,
  detailLoading,
  autoRunning,
  onDetail,
  onRerun,
  onGenerate,
  generating,
  generatedOptimization,
}: {
  job: ProbeJob | null;
  probe: RecentProbe | null | undefined;
  engines: Engine[];
  loading: boolean;
  detailLoading: boolean;
  autoRunning: boolean;
  onDetail: (job: ProbeJob) => void;
  onRerun: (job: ProbeJob) => void;
  onGenerate: (job: ProbeJob, probe: RecentProbe | null | undefined) => void;
  generating: boolean;
  generatedOptimization: GeneratedOptimization | null;
}) {
  if (!job) {
    return (
      <div className="inset" style={{ color: 'var(--t-tertiary)', fontSize: 13 }}>
        {loading ? '正在加载最新探测任务' : '暂无最新探测任务。'}
      </div>
    );
  }
  const answerText = cleanAnswerText(job.answerPreview);
  const running = job.status === 'running' || job.status === 'pending';
  return (
    <div className="inset" style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
          <span className="t-label">最新探测</span>
          <strong style={{ color: 'var(--t-primary)', fontSize: 16 }}>{job.question}</strong>
          <p style={{ color: 'var(--t-secondary)', fontSize: 13 }}>
            {engineLabel(engines, job.engine)} · {fmtDate(job.finishedAt || job.createdAt)}
          </p>
        </div>
        <span className="badge">{running ? '生成中' : job.status}</span>
      </div>
      {job.errorMessage ? (
        <div style={{ color: 'var(--danger)', fontSize: 13 }}>{job.errorMessage}</div>
      ) : null}
      <p style={{ color: 'var(--t-secondary)', fontSize: 13, lineHeight: 1.7 }}>
        {answerText || (running ? '正在生成回答...' : '暂无回答摘要')}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        <FlowStep title="我方是否出现" desc={running ? '待分析' : (probe?.weCited ? '是' : '否')} />
        <FlowStep title="引用位次" desc={running ? '待分析' : (probe?.citationRank ? `第 ${probe.citationRank} 位` : '-')} />
        <FlowStep title="竞品占位" desc={running ? '待分析' : (probe?.competitorsCited?.length ? probe.competitorsCited.join('、') : '未命中竞品')} />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-outline btn-sm" type="button" onClick={() => onDetail(job)} disabled={detailLoading || running || job.id.startsWith('stream-')}>
          <Eye size={14} />
          查看详情
        </button>
        <button className="btn btn-outline btn-sm" type="button" onClick={() => onRerun(job)} disabled={autoRunning || running}>
          <RefreshCw size={14} />
          重新探测
        </button>
        <button className="btn btn-outline btn-sm" type="button" onClick={() => onGenerate(job, probe)} disabled={generating || running || job.id.startsWith('stream-')}>
          {generating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
          生成优化建议
        </button>
      </div>
      {generatedOptimization?.jobId === job.id ? (
        <div className="inset" style={{ display: 'grid', gap: 8 }}>
          <strong style={{ color: 'var(--t-primary)', fontSize: 13 }}>{generatedOptimization.title}</strong>
          <p style={{ color: 'var(--t-secondary)', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {cleanAnswerText(generatedOptimization.draft)}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function FlowStep({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <strong style={{ color: 'var(--t-primary)', fontSize: 13 }}>{title}</strong>
      <p style={{ marginTop: 4, color: 'var(--t-secondary)', fontSize: 12 }}>{desc}</p>
    </div>
  );
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ textAlign: 'center', color: 'var(--t-tertiary)', padding: 22 }}>{text}</td>
    </tr>
  );
}

function engineLabel(engines: Engine[], engine: string) {
  return engines.find((item) => item.engine === engine)?.label || engine;
}
