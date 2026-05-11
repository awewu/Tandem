/**
 * Privacy strip helpers · A2.2 endpoint 共享
 *
 * - strip1on1ForRequester: 员工读不到 privateManagerNote / moodScore (D6 隐私)
 * - strip360SubmissionForViewer: anonymizePeers=true 时 peer raterId 抹掉
 */

import type { OneOnOneMeeting } from '@/lib/types/one-on-one';
import type { Review360Submission, Review360Cycle } from '@/lib/types/review-360';

/**
 * 1on1 strip:
 *   - 主管 (managerId === requesterId): 看全
 *   - 员工 (reportId === requesterId): privateManagerNote=null + moodScore=null
 *   - 其他人: 不应该读到此 meeting (调用方应先做可见性过滤), 这里也再防御性 strip
 */
export function strip1on1ForRequester(
  meeting: OneOnOneMeeting,
  requesterId: string,
): OneOnOneMeeting {
  if (meeting.managerId === requesterId) return meeting;
  return {
    ...meeting,
    privateManagerNote: null,
    moodScore: null,
  };
}

/**
 * 360 submission strip:
 *   - subject 自己看自己结果: peer 类 raterId 抹掉 (anonymizePeers)
 *   - HR/admin / cycle owner 看全 (此函数不处理, 调用方决定是否调用)
 *   - rater 自己看自己提交: 看全
 */
export function strip360SubmissionForViewer(
  submission: Review360Submission,
  cycle: Pick<Review360Cycle, 'anonymizePeers'>,
  viewerId: string,
): Review360Submission {
  // rater 看自己: 看全
  if (submission.raterId === viewerId) return submission;
  // 若不需要匿名: 看全
  if (!cycle.anonymizePeers) return submission;
  // 匿名规则: peer / cross 类抹掉 raterId; self / manager / report 实名
  if (submission.raterType === 'peer' || submission.raterType === 'cross') {
    return { ...submission, raterId: 'anonymous' };
  }
  return submission;
}
