import { LiveStream } from '../types';

// Broadcasters pick a free-text category from LiveStreamRoomModal's Go Live
// Studio select (e.g. "Gaming & Esports", "Music & Performance"), while the
// Discovery filter chips use the short LIVE_CATEGORIES ids/names from
// pulseDb.ts (e.g. "gaming", "music"). Those don't line up as exact string
// matches, so filtering needs a keyword mapping rather than equality.
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  all: [],
  gaming: ['gaming', 'esports', 'game'],
  music: ['music', 'dj', 'sing', 'perform'],
  irl: ['irl', 'vlog', 'lifestyle'],
  creative: ['art', 'creative', 'design', 'craft'],
  chatting: ['chat', 'talk', 'qna', 'q&a'],
  tech: ['tech', 'coding', 'code', 'dev'],
  dance: ['dance', 'fitness'],
  comedy: ['comedy', 'fun', 'meme'],
  cooking: ['cook', 'food', 'recipe', 'kitchen'],
  fitness: ['fitness', 'workout', 'health', 'gym'],
};

export function matchesCategory(stream: LiveStream, categoryId: string): boolean {
  if (!categoryId || categoryId === 'all') return true;
  const keywords = CATEGORY_KEYWORDS[categoryId] || [categoryId];
  const haystack = `${stream.category || ''} ${stream.topic || ''} ${stream.title || ''}`.toLowerCase();
  return keywords.some(k => haystack.includes(k));
}

// Simple engagement score: viewers weighted higher than hearts since
// viewer count is a stronger live-interest signal than cumulative taps.
export function liveEngagementScore(stream: LiveStream): number {
  return (stream.viewerCount || 0) * 2 + (stream.heartsCount || 0) * 0.5 + (stream.totalGiftsCount || 0);
}

export function rankStreamsByEngagement(streams: LiveStream[]): LiveStream[] {
  return [...streams].sort((a, b) => liveEngagementScore(b) - liveEngagementScore(a));
}

export function filterStreamsByCategory(streams: LiveStream[], categoryId: string): LiveStream[] {
  return streams.filter(s => matchesCategory(s, categoryId));
}
