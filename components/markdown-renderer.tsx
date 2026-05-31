'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      className={cn('prose prose-sm dark:prose-invert max-w-none', className)}
      components={{
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '');
          return !inline && match ? (
            <SyntaxHighlighter
              style={vscDarkPlus}
              language={match[1]}
              PreTag="div"
              {...props}
            >
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          ) : (
            <code className={cn('rounded bg-muted px-1 py-0.5 text-caption font-mono', className)} {...props}>
              {children}
            </code>
          );
        },
        table({ children }) {
          return (
            <div className="overflow-auto">
              <table className="border-collapse text-caption">{children}</table>
            </div>
          );
        },
        th({ children }) {
          return <th className="border px-3 py-2 bg-muted font-semibold text-left">{children}</th>;
        },
        td({ children }) {
          return <td className="border px-3 py-2">{children}</td>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
