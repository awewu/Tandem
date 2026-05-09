'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ShieldCheck, Lock, AlertTriangle } from 'lucide-react';

/**
 * 代行授权控制台 (Manifesto 第十一/十二条)
 *
 * 给员工本人 (老板) 控制 AI 分身代行的边界:
 *   - 暂停学习
 *   - 配置可代行场景 (chat / email / standup / meeting)
 *   - 配置黑名单议题
 *   - 设定 token 预算
 *   - 紧急停止 (Kill switch)
 */

export interface DelegationSettings {
  learningActive: boolean;
  allowedScenarios: {
    chat: boolean;
    email: boolean;
    standup: boolean;
    meeting: boolean;
  };
  topicBlacklist: string[];
  dailyTokenBudget: number;
  killSwitchEngaged: boolean;
}

export function DelegationConsole({
  initial,
  onSave,
  onKillSwitch,
}: {
  initial: DelegationSettings;
  onSave: (s: DelegationSettings) => Promise<void>;
  onKillSwitch: () => Promise<void>;
}) {
  const [settings, setSettings] = useState<DelegationSettings>(initial);
  const [newTopic, setNewTopic] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onSave(settings);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            代行授权控制台
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            你 (员工本人) 是 AI 分身的最终主人. 任何代行边界都由你设定.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* 学习开关 */}
          <Row
            title="学习活跃"
            description="关闭后, AI 不再从你的行为中学习"
            control={
              <Switch
                checked={settings.learningActive}
                onCheckedChange={(v) =>
                  setSettings({ ...settings, learningActive: v })
                }
              />
            }
          />

          {/* 代行场景 */}
          <div>
            <h4 className="mb-2 text-sm font-medium">允许代行的场景</h4>
            <div className="space-y-2 rounded border p-3">
              {(['chat', 'email', 'standup', 'meeting'] as const).map((s) => (
                <Row
                  key={s}
                  title={scenarioLabel(s)}
                  description={scenarioDesc(s)}
                  control={
                    <Switch
                      checked={settings.allowedScenarios[s]}
                      onCheckedChange={(v) =>
                        setSettings({
                          ...settings,
                          allowedScenarios: { ...settings.allowedScenarios, [s]: v },
                        })
                      }
                    />
                  }
                />
              ))}
            </div>
          </div>

          {/* 黑名单议题 */}
          <div>
            <h4 className="mb-2 text-sm font-medium">议题黑名单</h4>
            <p className="mb-2 text-xs text-muted-foreground">
              出现这些关键词时, AI 立即停止代行 (高敏内容默认已加, 不可移除)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_BLACKLIST.map((t) => (
                <Badge key={t} variant="outline" className="bg-rose-50 text-rose-700">
                  <Lock className="mr-1 h-3 w-3" />
                  {t}
                </Badge>
              ))}
              {settings.topicBlacklist.map((t) => (
                <Badge
                  key={t}
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() =>
                    setSettings({
                      ...settings,
                      topicBlacklist: settings.topicBlacklist.filter((x) => x !== t),
                    })
                  }
                >
                  {t} ✕
                </Badge>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                placeholder="添加自定义关键词"
                className="flex-1 rounded border p-1.5 text-sm"
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (newTopic.trim()) {
                    setSettings({
                      ...settings,
                      topicBlacklist: [...settings.topicBlacklist, newTopic.trim()],
                    });
                    setNewTopic('');
                  }
                }}
              >
                添加
              </Button>
            </div>
          </div>

          {/* Token 预算 */}
          <div>
            <h4 className="mb-2 text-sm font-medium">日 Token 预算</h4>
            <p className="mb-2 text-xs text-muted-foreground">
              超过后 AI 停止任何代行操作. 默认 10 万 tokens / 天.
            </p>
            <input
              type="number"
              className="w-32 rounded border p-1.5 text-sm"
              value={settings.dailyTokenBudget}
              onChange={(e) =>
                setSettings({ ...settings, dailyTokenBudget: Number(e.target.value) || 0 })
              }
            />
          </div>

          <Button onClick={save} disabled={saving}>
            {saving ? '保存中...' : '保存设置'}
          </Button>
        </CardContent>
      </Card>

      {/* Kill Switch */}
      <Card className="border-rose-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-rose-700">
            <AlertTriangle className="h-5 w-5" />
            紧急停止 · Kill Switch
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            一键关闭所有 AI 代行. 已经派出的会议代参 / 邮件草稿都会立即停止. 24h 内已发送的代行
            操作可主动撤回.
          </p>
          <Button
            variant="destructive"
            onClick={onKillSwitch}
            disabled={settings.killSwitchEngaged}
          >
            {settings.killSwitchEngaged ? '已紧急停止' : '紧急停止 AI 代行'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

const DEFAULT_BLACKLIST = ['薪资', '裁员', '法律', '诉讼', '股权', '客户投诉'];

function scenarioLabel(s: string): string {
  return { chat: 'IM 聊天', email: '邮件', standup: 'Stand-up 汇报', meeting: '会议代参' }[s] ?? s;
}

function scenarioDesc(s: string): string {
  return (
    {
      chat: '允许 AI 代回 IM 消息 (高敏自动转人工)',
      email: '允许 AI 起草邮件 (必须员工本人发送)',
      standup: '允许 AI 代汇报每周进展',
      meeting: '允许分身加入会议 (转录 + 摘要, 红区强退)',
    }[s] ?? ''
  );
}

function Row({
  title,
  description,
  control,
}: {
  title: string;
  description?: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex-1">
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {control}
    </div>
  );
}
