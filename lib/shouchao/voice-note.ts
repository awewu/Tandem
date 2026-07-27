export type ShouchaoVoiceMode = 'note' | 'meeting';

export function deriveVoiceNoteTitle(text: string, mode: ShouchaoVoiceMode): string {
  const firstLine = text
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean) ?? '';
  return firstLine.replace(/^#+\s*/, '').slice(0, 30) || (mode === 'meeting' ? '会议纪要' : '语音笔记');
}

export function voiceNoteTag(mode: ShouchaoVoiceMode): string {
  return mode === 'meeting' ? '会议纪要' : '语音';
}

export function appendVoiceTextToNoteContent(content: string, voiceText: string): string {
  const cleanText = voiceText.trim();
  if (!cleanText) return content;
  const cleanContent = content.trimEnd();
  return cleanContent ? `${cleanContent}\n\n${cleanText}` : cleanText;
}
