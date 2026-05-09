import { useChatStore, useAgentStore, useTaskStore } from './store';

export function exportAllData(conversations: any[], agents: any[], tasks: any[]) {
  return JSON.stringify(
    {
      conversations,
      agents,
      tasks,
      exportedAt: new Date().toISOString(),
    },
    null,
    2
  );
}

export function importAllData(jsonText: string) {
  const data = JSON.parse(jsonText);
  return {
    conversations: data.conversations || [],
    agents: data.agents || [],
    tasks: data.tasks || [],
  };
}

export function downloadJson(filename: string, json: string) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportAll() {
  const data = {
    conversations: useChatStore.getState().conversations,
    agents: useAgentStore.getState().agents,
    tasks: useTaskStore.getState().tasks,
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hermes-backup-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importAll(file: File, mode: 'merge' | 'replace') {
  return new Promise<void>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (mode === 'replace') {
          useChatStore.setState({ conversations: data.conversations || [] });
          useAgentStore.setState({ agents: data.agents || [] });
          useTaskStore.setState({ tasks: data.tasks || [] });
        } else {
          useChatStore.setState((s) => ({
            conversations: [...(data.conversations || []), ...s.conversations],
          }));
          useAgentStore.setState((s) => ({
            agents: [...(data.agents || []), ...s.agents],
          }));
          useTaskStore.setState((s) => ({
            tasks: [...(data.tasks || []), ...s.tasks],
          }));
        }
        resolve();
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsText(file);
  });
}
