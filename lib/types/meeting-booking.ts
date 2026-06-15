/**
 * MeetingBooking · 会议室预订
 *
 * KvStore-backed (collection: 'meeting_bookings'). 身份字段 (createdBy/tenantId)
 * 取自鉴权上下文, 不接受 body 注入. 字段白名单写入, 防止伪造归属/越权字段.
 */

export interface MeetingBooking {
  id: string;
  tenantId: string;
  /** 预订人 userId (取自鉴权上下文) */
  createdBy: string;
  title: string;
  room?: string;
  /** ISO8601 起止时间 */
  startAt?: string;
  endAt?: string;
  attendees?: string[];
  notes?: string;
  createdAt: string;
}
