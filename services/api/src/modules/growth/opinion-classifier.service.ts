import { Injectable, Logger } from '@nestjs/common';
import { AiGatewayService } from './ai-gateway.service';

/**
 * 增长中枢 · E1 舆情分级器（G3）。
 *
 * 优先用 AI 网关做多维分级（情感/意图/危机等级/实体识别），返回结构化 JSON；
 * 无模型密钥或解析失败时回落到确定性启发式，保证 source-contract 可运行、可测试。
 */

export interface MentionGrading {
  sentiment: 'positive' | 'negative' | 'neutral';
  intent: 'inquiry' | 'complaint' | 'compare' | 'smear' | 'general';
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  entities: string[];
  method: 'ai' | 'heuristic';
}

const SENTIMENTS = ['positive', 'negative', 'neutral'];
const INTENTS = ['inquiry', 'complaint', 'compare', 'smear', 'general'];
const SEVERITIES = ['P0', 'P1', 'P2', 'P3'];

@Injectable()
export class OpinionClassifierService {
  private readonly logger = new Logger('GrowthOpinionClassifier');

  constructor(private readonly ai: AiGatewayService) {}

  async classify(content: string): Promise<MentionGrading> {
    const text = String(content || '');
    const ai = await this.tryAi(text);
    if (ai) return ai;
    return { ...this.heuristic(text), method: 'heuristic' };
  }

  private async tryAi(text: string): Promise<MentionGrading | null> {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.GROWTH_AI_API_KEY) return null;
    const system =
      '你是舆情分析器。只输出 JSON，无多余文字。字段：sentiment(positive/negative/neutral)、' +
      'intent(inquiry/complaint/compare/smear/general)、severity(P0/P1/P2/P3，P0=安全/群体/媒体级危机)、entities(品牌/产品/门店字符串数组)。';
    try {
      const res = await this.ai.generateDraft({ system, prompt: `分析这条内容并输出 JSON：\n${text}` });
      const parsed = this.parseJson(res.draft);
      if (!parsed) return null;
      const g = this.coerce(parsed);
      return g ? { ...g, method: 'ai' } : null;
    } catch (err: unknown) {
      this.logger.warn(`AI classify failed, using heuristic: ${String(err)}`);
      return null;
    }
  }

  private parseJson(raw: string): Record<string, unknown> | null {
    if (!raw) return null;
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch { return null; }
  }

  private coerce(o: Record<string, unknown>): Omit<MentionGrading, 'method'> | null {
    const sentiment = String(o.sentiment || '');
    const intent = String(o.intent || '');
    const severity = String(o.severity || '');
    if (!SENTIMENTS.includes(sentiment) || !INTENTS.includes(intent) || !SEVERITIES.includes(severity)) return null;
    const entities = Array.isArray(o.entities) ? o.entities.map(String).slice(0, 20) : [];
    return {
      sentiment: sentiment as MentionGrading['sentiment'],
      intent: intent as MentionGrading['intent'],
      severity: severity as MentionGrading['severity'],
      entities,
    };
  }

  /**
   * 确定性启发式（无 AI 时的兜底；与 G0 一致，抽到分级器统一维护）。
   * P0 判定收紧：仅在「明确危机词」出现时触发，避免中性语境（如「安全性对比」含"安全"）误报。
   * 「安全」等模糊词必须与事故/隐患/风险等词共现才升级为危机。
   */
  private heuristic(text: string): Omit<MentionGrading, 'method'> {
    const negative = /(投诉|差评|漏水|故障|退款|骗局|被坑|维权|曝光|虚假|欺诈|翻车|退货|售后差)/.test(text);
    // 明确危机词：本身即为群体/安全/媒体级事件。
    const hardCrisis = /(爆炸|起火|着火|伤亡|中毒|触电|召回|停产|集体维权|群体投诉|群体性事件|315晚会|媒体曝光|上门维权)/.test(text);
    // 模糊危机词：需与危机语境共现（避免「安全性/安全阀」等中性用法误判）。
    const vagueCrisis =
      /(安全|事故|隐患)/.test(text) && /(事故|隐患|风险|问题|重大|严重|危险|不达标|超标|致命)/.test(text);
    const crisis = hardCrisis || vagueCrisis;
    const smear = /(黑稿|抹黑|水军|造谣|恶意)/.test(text);
    const compare = /(对比|不如|哪个好|性价比|推荐哪个|测评|评测|选购)/.test(text);
    return {
      // 中性对比/测评类内容不因含危机模糊词而误判为负面。
      sentiment: negative || smear ? 'negative' : 'neutral',
      intent: smear ? 'smear' : negative ? 'complaint' : compare ? 'compare' : 'general',
      // P0 仅在真实危机时；负面/抹黑为 P1；纯对比/中性为 P3。
      severity: crisis && (negative || smear || hardCrisis) ? 'P0' : (negative || smear) ? 'P1' : 'P3',
      entities: [],
    };
  }
}
