'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

/**
 * 承诺式确认对话框 (品牌化替换原生 confirm()).
 * 返回 { confirm, dialog }: confirm(opts) => Promise<boolean>; dialog 需渲染进组件树一次.
 * 既可用于 React 事件处理, 也可用于非 render 回调 (如 FileReader.onload), 因其返回 Promise.
 */
export function useConfirm() {
  const [state, setState] = React.useState<ConfirmState | null>(null);

  const confirm = React.useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setState({ ...opts, resolve })),
    [],
  );

  const settle = React.useCallback(
    (value: boolean) => {
      setState((prev) => {
        prev?.resolve(value);
        return null;
      });
    },
    [],
  );

  const dialog = (
    <Dialog open={!!state} onOpenChange={(open) => { if (!open) settle(false); }}>
      {state && (
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{state.title}</DialogTitle>
            {state.description != null && (
              <DialogDescription className="whitespace-pre-line">
                {state.description}
              </DialogDescription>
            )}
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => settle(false)}>
              {state.cancelText ?? '取消'}
            </Button>
            <Button
              variant={state.destructive ? 'destructive' : 'default'}
              size="sm"
              onClick={() => settle(true)}
            >
              {state.confirmText ?? '确定'}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );

  return { confirm, dialog };
}
