import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: LucideIcon;
}

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center py-12 px-6 rounded-lg border border-dashed bg-muted/20',
        className
      )}
    >
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-headline mb-1">{title}</h3>
      {description && (
        <p className="text-caption text-muted-foreground max-w-md mb-5 whitespace-pre-line">
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-2">
          {action &&
            (action.href ? (
              <Button asChild>
                <a href={action.href}>
                  {action.icon && <action.icon className="h-4 w-4 mr-1.5" />}
                  {action.label}
                </a>
              </Button>
            ) : (
              <Button onClick={action.onClick}>
                {action.icon && <action.icon className="h-4 w-4 mr-1.5" />}
                {action.label}
              </Button>
            ))}
          {secondaryAction &&
            (secondaryAction.href ? (
              <Button variant="outline" asChild>
                <a href={secondaryAction.href}>
                  {secondaryAction.icon && (
                    <secondaryAction.icon className="h-4 w-4 mr-1.5" />
                  )}
                  {secondaryAction.label}
                </a>
              </Button>
            ) : (
              <Button variant="outline" onClick={secondaryAction.onClick}>
                {secondaryAction.icon && (
                  <secondaryAction.icon className="h-4 w-4 mr-1.5" />
                )}
                {secondaryAction.label}
              </Button>
            ))}
        </div>
      )}
    </div>
  );
}
