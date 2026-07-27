'use client';

import { Download, Printer } from 'lucide-react';

export function PrivacyPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-hairline bg-white px-3 text-caption font-medium text-ink-secondary shadow-soft-xs hover:bg-surface-2 hover:text-ink-primary"
    >
      <Printer className="h-4 w-4" />
      <span className="hidden sm:inline">打印</span>
      <Download className="h-4 w-4" />
      <span>保存 PDF</span>
    </button>
  );
}
