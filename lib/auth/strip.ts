/**
 * Privacy strip helpers · A2.2 endpoint 共享
 *
 * EVO-7 (2026-05-12): 重构为 thin wrapper over lib/privacy/redactors-domain.
 * 调用点 0 改动, 保持向后兼容; 新代码请直接使用 `lib/privacy/redactor` 框架.
 *
 * - strip1on1ForRequester: 员工读不到 privateManagerNote / moodScore (D6 隐私)
 * - strip360SubmissionForViewer: anonymizePeers=true 时 peer raterId 抹掉
 */

export {
  strip1on1ForRequester,
  strip360SubmissionForViewer,
} from '@/lib/privacy/redactors-domain';
