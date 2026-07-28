import { describe, expect, it } from 'vitest';
import {
  appendVoiceTextToNoteContent,
  deriveVoiceNoteTitle,
  normalizeVoiceTranscriptionText,
  voiceNoteTag,
} from '@/lib/shouchao/voice-note';

describe('shouchao voice note helpers', () => {
  it('fills an empty current note with transcribed voice text', () => {
    expect(appendVoiceTextToNoteContent('', '  今天记录一个想法  ')).toBe('今天记录一个想法');
  });

  it('appends transcribed voice text to the current note body', () => {
    expect(appendVoiceTextToNoteContent('已有内容\n', '新增语音内容')).toBe('已有内容\n\n新增语音内容');
  });

  it('derives title and tag from the transcribed text and mode', () => {
    expect(deriveVoiceNoteTitle('## 会议讨论\n- 待办', 'meeting')).toBe('会议讨论');
    expect(deriveVoiceNoteTitle('', 'note')).toBe('语音笔记');
    expect(voiceNoteTag('meeting')).toBe('会议纪要');
  });

  it('removes markdown code fences returned by AI before saving voice notes', () => {
    const aiText = '```markdown\n## 今天的记录\n这是我要的文字。\n```';

    expect(normalizeVoiceTranscriptionText(aiText)).toBe('## 今天的记录\n这是我要的文字。');
    expect(deriveVoiceNoteTitle(aiText, 'note')).toBe('今天的记录');
    expect(appendVoiceTextToNoteContent('', aiText)).toBe('## 今天的记录\n这是我要的文字。');
  });
});
