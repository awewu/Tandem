'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, Save, FilePlus, CheckCircle, Palette, Type, Layout, Box, Trash2 } from 'lucide-react';

const TEMPLATES = [
  {
    name: 'Minimal',
    description: 'Clean and minimal design system.',
    content: `---
version: alpha
name: Minimal
description: Clean and minimal design system.
colors:
  primary: "#111111"
  secondary: "#666666"
  background: "#FFFFFF"
  surface: "#F5F5F5"
typography:
  heading:
    fontFamily: Inter
    fontSize: 2rem
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: 4px
  md: 8px
  lg: 16px
spacing:
  sm: 8px
  md: 16px
  lg: 24px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: 12px
---

## Overview
A clean, minimal design system for modern web apps.

## Colors
- **Primary (#111111):** Main action and text color.
- **Background (#FFFFFF):** Page background.

## Typography
Inter for all text. Clear hierarchy through size and weight.

## Components
Button-primary is the main CTA, using primary color with white text.
`,
  },
  {
    name: 'Dark Mode',
    description: 'High-contrast dark theme with blue accents.',
    content: `---
version: alpha
name: Dark Mode
description: High-contrast dark theme.
colors:
  primary: "#60A5FA"
  secondary: "#94A3B8"
  background: "#0F172A"
  surface: "#1E293B"
typography:
  heading:
    fontFamily: Inter
    fontSize: 2rem
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.6
rounded:
  sm: 6px
  md: 12px
  lg: 20px
spacing:
  sm: 8px
  md: 16px
  lg: 24px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#0F172A"
    rounded: "{rounded.md}"
    padding: 12px
---

## Overview
Dark mode design system with blue accents.

## Colors
- **Primary (#60A5FA):** Actions and links.
- **Background (#0F172A):** Deep navy background.

## Typography
Inter with slightly increased line height for readability on dark backgrounds.

## Components
Button-primary uses blue background with dark text for high contrast.
`,
  },
  {
    name: 'Neon Cyberpunk',
    description: 'High-energy neon on dark.',
    content: `---
version: alpha
name: Neon Cyberpunk
description: High-energy neon on dark.
colors:
  primary: "#00F0FF"
  secondary: "#FF00A0"
  background: "#050505"
  surface: "#111111"
typography:
  heading:
    fontFamily: "JetBrains Mono"
    fontSize: 2rem
    fontWeight: 800
    lineHeight: 1.1
  body:
    fontFamily: "JetBrains Mono"
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: 0px
  md: 2px
  lg: 4px
spacing:
  sm: 4px
  md: 8px
  lg: 16px
components:
  button-primary:
    backgroundColor: "#00F0FF"
    textColor: "#050505"
    rounded: "{rounded.md}"
    padding: 10px
---

## Overview
Cyberpunk aesthetic with sharp corners and neon accents.

## Colors
- **Primary (#00F0FF):** Cyan neon accent.
- **Secondary (#FF00A0):** Magenta neon accent.

## Typography
JetBrains Mono for a technical, terminal-like feel.

## Components
Sharp edges, minimal padding, maximum impact.
`,
  },
];

export default function DesignPage() {
  const [files, setFiles] = useState<{ id: string; name: string; content: string }[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    const raw = localStorage.getItem('铁山-design-files');
    if (raw) {
      try {
        setFiles(JSON.parse(raw));
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('铁山-design-files', JSON.stringify(files));
  }, [files]);

  const selected = files.find((f) => f.id === selectedId);

  const createFromTemplate = (tpl: (typeof TEMPLATES)[number]) => {
    const id = crypto.randomUUID();
    const newFile = { id, name: `${tpl.name}.md`, content: tpl.content };
    setFiles((prev) => [...prev, newFile]);
    setSelectedId(id);
    setEditName(newFile.name);
    setEditContent(newFile.content);
  };

  const createBlank = () => {
    const id = crypto.randomUUID();
    const blank = `---\nversion: alpha\nname: New Design\ndescription: \ncolors:\n  primary: "#000000"\n  secondary: "#666666"\n  background: "#FFFFFF"\n  surface: "#F5F5F5"\ntypography:\n  heading:\n    fontFamily: Inter\n    fontSize: 2rem\n    fontWeight: 600\n    lineHeight: 1.2\n  body:\n    fontFamily: Inter\n    fontSize: 1rem\n    fontWeight: 400\n    lineHeight: 1.5\nrounded:\n  sm: 4px\n  md: 8px\n  lg: 16px\nspacing:\n  sm: 8px\n  md: 16px\n  lg: 24px\ncomponents:\n  button-primary:\n    backgroundColor: "{colors.primary}"\n    textColor: "#FFFFFF"\n    rounded: "{rounded.md}"\n    padding: 12px\n---\n\n## Overview\n\n## Colors\n\n## Typography\n\n## Components\n`;
    const newFile = { id, name: 'NewDesign.md', content: blank };
    setFiles((prev) => [...prev, newFile]);
    setSelectedId(id);
    setEditName(newFile.name);
    setEditContent(newFile.content);
  };

  const saveSelected = () => {
    if (!selected) return;
    setFiles((prev) =>
      prev.map((f) => (f.id === selected.id ? { ...f, name: editName, content: editContent } : f))
    );
  };

  const deleteSelected = () => {
    if (!selected) return;
    setFiles((prev) => prev.filter((f) => f.id !== selected.id));
    setSelectedId(null);
  };

  const validateDesignMd = (content: string) => {
    const hasFrontmatter = content.startsWith('---') && content.includes('---', 3);
    const hasColors = content.includes('colors:');
    const hasTypography = content.includes('typography:');
    return hasFrontmatter && hasColors && hasTypography;
  };

  return (
    <div className="flex h-full">
      <div className="w-72 border-r flex flex-col">
        <div className="p-3 border-b space-y-2">
          <Button variant="outline" size="sm" className="w-full" onClick={createBlank}>
            <FilePlus className="mr-1 h-3 w-3" /> Blank DESIGN.md
          </Button>
        </div>
        <ScrollArea className="flex-1 p-2">
          <div className="space-y-1">
            {files.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setSelectedId(f.id);
                  setEditName(f.name);
                  setEditContent(f.content);
                }}
                className={`w-full text-left px-3 py-2 rounded-md text-caption flex items-center gap-2 ${
                  selectedId === f.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                }`}
              >
                <Palette className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{f.name}</span>
                {validateDesignMd(f.content) && <CheckCircle className="h-3 w-3 text-success ml-auto shrink-0" />}
              </button>
            ))}
            {files.length === 0 && (
              <p className="text-footnote text-muted-foreground px-2">No files yet. Create from template or blank.</p>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        {selected ? (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-64"
                />
                <Badge variant={validateDesignMd(editContent) ? 'default' : 'destructive'}>
                  {validateDesignMd(editContent) ? 'Valid' : 'Invalid'}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveSelected}>
                  <Save className="mr-1 h-3 w-3" /> Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  const blob = new Blob([editContent], { type: 'text/markdown' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = editName;
                  a.click();
                  URL.revokeObjectURL(url);
                }}>
                  <Download className="mr-1 h-3 w-3" /> Export
                </Button>
                <Button size="sm" variant="destructive" onClick={deleteSelected}>
                  <Trash2 className="mr-1 h-3 w-3" /> Delete
                </Button>
              </div>
            </div>
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[600px] font-mono text-caption"
            />
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <h1 className="text-title-3 font-bold tracking-tight">Design System</h1>
              <p className="text-muted-foreground mt-1">
                Manage DESIGN.md tokens and design systems. Based on Google DESIGN.md spec.
              </p>
            </div>

            <Tabs defaultValue="templates">
              <TabsList>
                <TabsTrigger value="templates">Templates</TabsTrigger>
                <TabsTrigger value="guide">Guide</TabsTrigger>
              </TabsList>
              <TabsContent value="templates" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {TEMPLATES.map((tpl) => (
                    <Card key={tpl.name} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => createFromTemplate(tpl)}>
                      <CardHeader>
                        <CardTitle className="text-body">{tpl.name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-caption text-muted-foreground">{tpl.description}</p>
                        <div className="flex gap-2 mt-3">
                          <Badge variant="outline"><Palette className="mr-1 h-3 w-3" /> Colors</Badge>
                          <Badge variant="outline"><Type className="mr-1 h-3 w-3" /> Typography</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="guide">
                <Card>
                  <CardHeader>
                    <CardTitle>DESIGN.md Spec</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-caption">
                    <p>A DESIGN.md file contains frontmatter YAML + markdown sections.</p>
                    <ul className="list-disc ml-5 space-y-1 text-muted-foreground">
                      <li><strong>colors:</strong> primary, secondary, background, surface, error, success</li>
                      <li><strong>typography:</strong> heading and body with fontFamily, fontSize, fontWeight, lineHeight</li>
                      <li><strong>rounded:</strong> sm, md, lg corner radii</li>
                      <li><strong>spacing:</strong> sm, md, lg spacing scale</li>
                      <li><strong>components:</strong> named component tokens referencing other tokens</li>
                    </ul>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}
