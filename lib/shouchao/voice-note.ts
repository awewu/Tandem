export type ShouchaoVoiceMode = 'note' | 'meeting';

export function normalizeVoiceTranscriptionText(text: string): string {
  let clean = (text ?? '').replace(/\r\n/g, '\n').replace(/^\uFEFF/, '').trim();
  if (!clean) return '';

  const fenced = clean.match(/^```(?:markdown|md|text)?[ \t]*\n([\s\S]*?)\n?```[ \t]*$/i);
  if (fenced) return fenced[1].trim();

  const lines = clean.split('\n');
  if (/^```(?:markdown|md|text)?[ \t]*$/i.test(lines[0].trim())) {
    lines.shift();
    if (lines.length > 0 && /^```[ \t]*$/.test(lines[lines.length - 1].trim())) {
      lines.pop();
    }
    clean = lines.join('\n').trim();
  }

  return clean;
}

export function deriveVoiceNoteTitle(text: string, mode: ShouchaoVoiceMode): string {
  const firstLine = normalizeVoiceTranscriptionText(text)
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean) ?? '';
  return firstLine.replace(/^#+\s*/, '').slice(0, 30) || (mode === 'meeting' ? '会议纪要' : '语音笔记');
}

export function voiceNoteTag(mode: ShouchaoVoiceMode): string {
  return mode === 'meeting' ? '会议纪要' : '语音';
}

export function appendVoiceTextToNoteContent(content: string, voiceText: string): string {
  const cleanText = normalizeVoiceTranscriptionText(voiceText);
  if (!cleanText) return content;
  const cleanContent = content.trimEnd();
  return cleanContent ? `${cleanContent}\n\n${cleanText}` : cleanText;
}
