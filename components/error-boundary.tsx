'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-lg border bg-card text-card-foreground shadow-soft-sm p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-destructive/10 p-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <h2 className="text-headline font-semibold">出错了</h2>
              <p className="text-footnote text-muted-foreground">
                Something went wrong while rendering this view.
              </p>
            </div>
          </div>
          <pre className="text-footnote font-mono bg-muted p-3 rounded-md overflow-auto max-h-48 whitespace-pre-wrap break-words">
            {error.message || String(error)}
            {error.stack && (
              <>
                {'\n\n'}
                {error.stack
                  .split('\n')
                  .slice(0, 6)
                  .join('\n')}
              </>
            )}
          </pre>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => (window.location.href = '/')}>
              <Home className="h-3.5 w-3.5 mr-1.5" />
              Home
            </Button>
            <Button size="sm" onClick={this.reset}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              重试
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
