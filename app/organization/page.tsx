'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOrgStore, useAgentStore } from '@/lib/store';
import { Swords, Users, Plus, Trash2, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function OrganizationPage() {
  const { departments, setDepartments } = useOrgStore();
  const { agents } = useAgentStore();
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [selectedMinistryId, setSelectedMinistryId] = useState<string | null>(null);

  const selectedDept = departments.find((d) => d.id === selectedDeptId);
  const selectedMinistry = selectedDept?.ministries.find((m) => m.id === selectedMinistryId);

  const updateMinistry = (deptId: string, minId: string, patch: any) => {
    setDepartments(
      departments.map((d) =>
        d.id === deptId
          ? {
              ...d,
              ministries: d.ministries.map((m) => (m.id === minId ? { ...m, ...patch } : m)),
            }
          : d
      )
    );
  };

  const addMinistry = (deptId: string) => {
    setDepartments(
      departments.map((d) =>
        d.id === deptId
          ? {
              ...d,
              ministries: [
                ...d.ministries,
                {
                  id: crypto.randomUUID(),
                  name: 'New Ministry',
                  tag: 'custom',
                  agents: [],
                  description: '',
                },
              ],
            }
          : d
      )
    );
  };

  const removeMinistry = (deptId: string, minId: string) => {
    setDepartments(
      departments.map((d) =>
        d.id === deptId
          ? { ...d, ministries: d.ministries.filter((m) => m.id !== minId) }
          : d
      )
    );
    if (selectedMinistryId === minId) setSelectedMinistryId(null);
  };

  return (
    <div className="flex h-full">
      <div className="w-80 border-r flex flex-col">
        <div className="p-3 border-b">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <Swords className="h-4 w-4" /> 三省六部制
          </h2>
        </div>
        <ScrollArea className="flex-1 p-2">
          <div className="space-y-3">
            {departments.map((dept) => (
              <div key={dept.id}>
                <div
                  className={cn(
                    'px-3 py-2 rounded-md text-sm font-medium cursor-pointer',
                    selectedDeptId === dept.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                  )}
                  onClick={() => {
                    setSelectedDeptId(dept.id);
                    setSelectedMinistryId(null);
                  }}
                >
                  {dept.name}
                </div>
                <div className="ml-3 mt-1 space-y-0.5">
                  {dept.ministries.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        'flex items-center justify-between px-3 py-1.5 rounded-md text-xs cursor-pointer',
                        selectedMinistryId === m.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'
                      )}
                      onClick={() => {
                        setSelectedDeptId(dept.id);
                        setSelectedMinistryId(m.id);
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <Users className="h-3 w-3" />
                        {m.name}
                        <Badge variant="outline" className="text-[10px] h-4">{m.agents.length}</Badge>
                      </span>
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs h-7"
                    onClick={() => addMinistry(dept.id)}
                  >
                    <Plus className="mr-1 h-3 w-3" /> Add Ministry
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        {selectedMinistry ? (
          <div className="max-w-2xl mx-auto space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{selectedMinistry.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    value={selectedMinistry.name}
                    onChange={(e) =>
                      updateMinistry(selectedDept!.id, selectedMinistry.id, { name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Tag</label>
                  <Input
                    value={selectedMinistry.tag}
                    onChange={(e) =>
                      updateMinistry(selectedDept!.id, selectedMinistry.id, { tag: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    value={selectedMinistry.description}
                    onChange={(e) =>
                      updateMinistry(selectedDept!.id, selectedMinistry.id, { description: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Assigned Agents</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedMinistry.agents.map((agentId) => {
                      const agent = agents.find((a) => a.id === agentId);
                      return (
                        <Badge key={agentId} variant="secondary" className="gap-1">
                          {agent?.name || agentId}
                          <button
                            onClick={() =>
                              updateMinistry(selectedDept!.id, selectedMinistry.id, {
                                agents: selectedMinistry.agents.filter((id) => id !== agentId),
                              })
                            }
                            className="ml-1 hover:text-destructive"
                          >
                            ×
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                  <Select
                    onValueChange={(val) => {
                      if (!selectedMinistry.agents.includes(val)) {
                        updateMinistry(selectedDept!.id, selectedMinistry.id, {
                          agents: [...selectedMinistry.agents, val],
                        });
                      }
                    }}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Assign agent..." />
                    </SelectTrigger>
                    <SelectContent>
                      {agents
                        .filter((a) => !selectedMinistry.agents.includes(a.id))
                        .map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeMinistry(selectedDept!.id, selectedMinistry.id)}
                  >
                    <Trash2 className="mr-1 h-3 w-3" /> Delete Ministry
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : selectedDept ? (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>{selectedDept.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {selectedDept.ministries.length} ministries under this department.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedDept.ministries.map((m) => (
                  <Card key={m.id} className="cursor-pointer hover:border-primary/50" onClick={() => setSelectedMinistryId(m.id)}>
                    <CardContent className="p-4">
                      <div className="font-medium text-sm">{m.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">{m.description}</div>
                      <div className="flex gap-1 mt-2">
                        {m.agents.slice(0, 3).map((aid) => {
                          const a = agents.find((ag) => ag.id === aid);
                          return <Badge key={aid} variant="outline" className="text-[10px]">{a?.name || aid.slice(0, 6)}</Badge>;
                        })}
                        {m.agents.length > 3 && <Badge variant="outline" className="text-[10px]">+{m.agents.length - 3}</Badge>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Swords className="h-10 w-10 opacity-20" />
            <p className="mt-2">三省六部制 Agent 工作组管理</p>
            <p className="text-sm">选择左侧省/部进行管理</p>
          </div>
        )}
      </div>
    </div>
  );
}
