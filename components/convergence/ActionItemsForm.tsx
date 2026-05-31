'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, X, Calendar, User } from 'lucide-react';
import type { ActionItem } from '@/lib/types';

interface DraftItem {
  id: string;
  task: string;
  owner: string;
  due: string;
}

export function ActionItemsForm({
  cardId,
  initialItems = [],
  onSave,
  disabled = false,
}: {
  cardId: string;
  initialItems?: ActionItem[];
  onSave: (items: ActionItem[]) => Promise<void>;
  disabled?: boolean;
}) {
  const [items, setItems] = useState<DraftItem[]>(
    initialItems.length > 0
      ? initialItems.map((i) => ({ id: i.id, task: i.task, owner: i.owner, due: i.due }))
      : [newDraft()]
  );
  const [saving, setSaving] = useState(false);

  function addItem() {
    setItems((prev) => [...prev, newDraft()]);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function updateItem(id: string, field: keyof DraftItem, value: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  }

  async function handleSave() {
    const valid = items.filter((i) => i.task.trim() && i.owner.trim());
    if (valid.length === 0) return;
    setSaving(true);
    try {
      const actionItems: ActionItem[] = valid.map((d) => ({
        id: d.id,
        owner: d.owner,
        task: d.task,
        due: d.due,
        status: 'open',
        decisionCardId: cardId,
      }));
      await onSave(actionItems);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-body flex items-center justify-between">
          <span>Action Items</span>
          <Button size="sm" variant="ghost" onClick={addItem} disabled={disabled}>
            <Plus className="h-4 w-4" />
            添加
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="space-y-2 rounded border p-3">
            <div className="flex items-start gap-2">
              <textarea
                className="flex-1 rounded border p-2 text-caption"
                rows={2}
                placeholder="任务描述 (做什么)"
                value={item.task}
                onChange={(e) => updateItem(item.id, 'task', e.target.value)}
                disabled={disabled}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeItem(item.id)}
                disabled={disabled}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1 rounded border p-1.5">
                <User className="h-3 w-3 text-muted-foreground" />
                <input
                  className="flex-1 bg-transparent text-caption outline-none"
                  placeholder="负责人 (userId 或邮箱)"
                  value={item.owner}
                  onChange={(e) => updateItem(item.id, 'owner', e.target.value)}
                  disabled={disabled}
                />
              </div>
              <div className="flex items-center gap-1 rounded border p-1.5">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                <input
                  type="date"
                  className="flex-1 bg-transparent text-caption outline-none"
                  value={item.due ? item.due.split('T')[0] : ''}
                  onChange={(e) =>
                    updateItem(item.id, 'due', new Date(e.target.value).toISOString())
                  }
                  disabled={disabled}
                />
              </div>
            </div>
          </div>
        ))}

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={disabled || saving}>
            {saving ? '保存中...' : '保存 Action Items'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function newDraft(): DraftItem {
  return {
    id: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    task: '',
    owner: '',
    due: new Date(Date.now() + 7 * 86400000).toISOString(),
  };
}
