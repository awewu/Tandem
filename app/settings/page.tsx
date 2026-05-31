'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useTheme } from '@/components/theme-provider';
import { useChatStore, useAgentStore, useTaskStore } from '@/lib/store';
import { exportAllData, importAllData, downloadJson } from '@/lib/export-import';
import { testHealth } from '@/lib/hermes-api';
import { toast } from '@/hooks/use-toast';
import { Server, Sun, Moon, Monitor, Download, Upload, Trash2, RefreshCw, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [apiUrl, setApiUrl] = useState('http://localhost:8000');
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const conversations = useChatStore((s) => s.conversations);
  const agents = useAgentStore((s) => s.agents);
  const tasks = useTaskStore((s) => s.tasks);
  const deleteConversation = useChatStore((s) => s.deleteConversation);
  const deleteAgent = useAgentStore((s) => s.deleteAgent);
  const deleteTask = useTaskStore((s) => s.deleteTask);

  async function handleTest() {
    setTesting(true);
    setTestStatus('idle');
    const ok = await testHealth(apiUrl);
    setTestStatus(ok ? 'success' : 'error');
    setTesting(false);
  }

  function handleExport() {
    const json = exportAllData(conversations, agents, tasks);
    downloadJson(`hermes-backup-${new Date().toISOString().slice(0, 10)}.json`, json);
    toast({ title: 'Exported', description: 'Backup downloaded successfully.' });
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // reset input so re-selecting the same file fires onChange again
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = importAllData(ev.target?.result as string);
        const summary = `${data.conversations.length} conversations, ${data.agents.length} agents, ${data.tasks.length} tasks`;
        const mode = window.confirm(
          `Import found:\n  ${summary}\n\nClick OK to REPLACE current data, or Cancel to MERGE (keep existing + add imported).`
        )
          ? 'replace'
          : 'merge';
        if (mode === 'replace') {
          useChatStore.setState({ conversations: data.conversations });
          useAgentStore.setState({ agents: data.agents });
          useTaskStore.setState({ tasks: data.tasks });
        } else {
          useChatStore.setState((s) => ({
            conversations: [...data.conversations, ...s.conversations],
          }));
          useAgentStore.setState((s) => ({
            agents: [...data.agents, ...s.agents],
          }));
          useTaskStore.setState((s) => ({
            tasks: [...data.tasks, ...s.tasks],
          }));
        }
        toast({
          title: mode === 'replace' ? 'Imported (Replaced)' : 'Imported (Merged)',
          description: `Applied ${summary}.`,
        });
      } catch {
        toast({ title: 'Import Failed', description: 'Invalid JSON file.', variant: 'destructive' });
      }
    };
    reader.readAsText(file);
  }

  function handleClearAll() {
    if (confirm('Delete ALL data? This cannot be undone.')) {
      conversations.forEach((c) => deleteConversation(c.id));
      agents.forEach((a) => deleteAgent(a.id));
      tasks.forEach((t) => deleteTask(t.id));
      toast({ title: 'Cleared', description: 'All local data removed.' });
    }
  }

  return (
    <div className="space-y-6 max-w-3xl md:px-8">
      <h1 className="text-title-2 font-bold tracking-tight">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Server size={18} /> Backend Connection</CardTitle>
          <CardDescription>Connect the WebUI to your Hermes Agent bridge</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-muted p-3 text-caption">
            <div className="flex items-center gap-2 font-medium mb-1">
              <ExternalLink size={14} /> Quick Start
            </div>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Open a new terminal and run: <code className="bg-background px-1 rounded">cd bridge && start.bat</code></li>
              <li>Come back here and click <strong>Test Connection</strong></li>
              <li>If green, everything is ready. If red, check that the bridge is running on port 8000.</li>
            </ol>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="endpoint">Bridge URL</Label>
            <div className="flex gap-2">
              <Input id="endpoint" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="http://localhost:8000" />
              <Button variant="outline" onClick={handleTest} disabled={testing}>
                {testing ? <RefreshCw size={14} className="animate-spin" /> : 'Test'}
              </Button>
            </div>
            {testStatus === 'success' && (
              <div className="flex items-center gap-1 text-caption text-success">
                <CheckCircle size={14} /> Connected to Hermes bridge successfully
              </div>
            )}
            {testStatus === 'error' && (
              <div className="flex items-center gap-1 text-caption text-danger">
                <AlertCircle size={14} /> Cannot reach bridge. Is <code>start.bat</code> running?
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="apiKey">API Key (optional)</Label>
            <Input id="apiKey" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Leave empty if no auth" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize the interface</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Theme</div>
              <div className="text-caption text-muted-foreground">Light, dark, or follow system</div>
            </div>
            <div className="flex gap-1">
              <Button variant={theme === 'light' ? 'default' : 'outline'} size="sm" onClick={() => setTheme('light')}><Sun size={14} className="mr-1" /> Light</Button>
              <Button variant={theme === 'dark' ? 'default' : 'outline'} size="sm" onClick={() => setTheme('dark')}><Moon size={14} className="mr-1" /> Dark</Button>
              <Button variant={theme === 'system' ? 'default' : 'outline'} size="sm" onClick={() => setTheme('system')}><Monitor size={14} className="mr-1" /> Auto</Button>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Stream Responses</div>
              <div className="text-caption text-muted-foreground">Token-by-token generation in chat</div>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Auto-save</div>
              <div className="text-caption text-muted-foreground">Persist data to browser storage</div>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
          <CardDescription>Backup and restore</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={handleExport}>
              <Download size={14} /> Export Backup
            </Button>
            <label className="cursor-pointer">
              <input type="file" accept=".json" className="hidden" onChange={handleImport} />
              <div className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-caption font-medium hover:bg-accent">
                <Upload size={14} /> Import Backup
              </div>
            </label>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-destructive">Reset All Data</div>
              <div className="text-caption text-muted-foreground">Permanently delete everything</div>
            </div>
            <Button variant="destructive" size="sm" onClick={handleClearAll}>
              <Trash2 size={14} className="mr-1" /> Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="text-center text-footnote text-muted-foreground pt-4">
        Hermes Agent WebUI v0.1.0 · Next.js + shadcn/ui
      </div>
    </div>
  );
}
