import React, { useState, useEffect } from 'react';
import { SearchResultItem, VideoPost, UserProfile, LiveStream } from '../types';
import { LiveDiscoveryGrid } from './live/LiveDiscoveryGrid';
import { searchFirestore, subscribeToActiveLiveStreams, fetchPopularCreators, getTrendingSearches, logSearchTerm } from '../services/pulseDb';
import { formatCount } from '../utils/formatters';
import { 
  Search, 
  ArrowLeft, 
  X, 
  Clock, 
  Music, 
  TrendingUp, 
  Sparkles, 
  RotateCw, 
  MoreVertical, 
  Radio, 
  Play, 
  Users, 
  Hash, 
  MessageSquare,
  ChevronRight
} from 'lucide-react';
import { VerifiedBadge } from './VerifiedBadge';

interface SearchPageProps {
  isOpen: boolean;
  initialQuery?: string;
  currentUser: UserProfile | null;
  onClose: () => void;
  onSelectUser: (handle: string, uid: string) => void;
  onSelectTag?: (tag: string) => void;
  onOpenChat?: (user: { uid: string; handle: string; avatar: string }) => void;
  onSelectVideo?: (video: VideoPost) => void;
  onEnterLiveRoom: (stream: LiveStream) => void;
  onRequireAuth: () => void;
  onToast: (msg: string) => void;
}



export const SearchPage: React.FC<SearchPageProps> = ({
  isOpen,
  initialQuery,
  currentUser,
  onClose,
  onSelectUser,
  onSelectTag,
  onOpenChat,
  onSelectVideo,
  onEnterLiveRoom,
  onRequireAuth,
  onToast
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'top' | 'users' | 'videos' | 'hashtags' | 'sounds'>('top');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [trendingSearches, setTrendingSearches] = useState<{ term: string; count: number; isHot: boolean }[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeLiveStreams, setActiveLiveStreams] = useState<LiveStream[]>([]);
  const [popularCreators, setPopularCreators] = useState<UserProfile[]>([]);

  const loadTrending = () => {
    getTrendingSearches().then(setTrendingSearches);
  };

  useEffect(() => {
    const unsub = subscribeToActiveLiveStreams((streams) => {
      setActiveLiveStreams(streams);
    });
    fetchPopularCreators(8).then((creators) => {
      setPopularCreators(creators);
    });
    loadTrending();
    return () => {
      if (unsub) unsub();
    };
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('pulse_recent_searches');
    if (stored) {
      try {
        setRecentSearches(JSON.parse(stored));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (isOpen && initialQuery) {
      setSearchTerm(initialQuery);
      handleSearch(initialQuery);
    }
  }, [isOpen, initialQuery]);

  if (!isOpen) return null;

  const saveRecent = (term: string) => {
    const updated = [term, ...recentSearches.filter(t => t !== term)].slice(0, 8);
    setRecentSearches(updated);
    localStorage.setItem('pulse_recent_searches', JSON.stringify(updated));
  };

  const handleRemoveRecent = (term: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = recentSearches.filter(t => t !== term);
    setRecentSearches(updated);
    localStorage.setItem('pulse_recent_searches', JSON.stringify(updated));
  };

  const handleSearch = async (term: string) => {
    setSearchTerm(term);
    if (!term.trim()) {
      setResults([]);
      return;
    }

    setSearching(true);
    try {
      const res = await searchFirestore(term);
      setResults(res);
      saveRecent(term.trim());
      logSearchTerm(term.trim());
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  };

  // Filter results according to active tab
  const filteredResults = results.filter(item => {
    if (activeFilter === 'top') return true;
    if (activeFilter === 'users') return item.type === 'user';
    if (activeFilter === 'videos') return item.type === 'video';
    if (activeFilter === 'hashtags') return item.type === 'tag';
    if (activeFilter === 'sounds') return item.type === 'sound';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black text-white max-w-[480px] mx-auto flex flex-col animate-in fade-in select-none font-sans">
      {/* 1. TOP SEARCH HEADER */}
      <div className="flex items-center gap-2.5 px-3.5 shrink-0" style={{ height: 'var(--header)', borderBottom: '1px solid var(--line)', background: 'var(--bg)' }}>
        <button
          onClick={onClose}
          className="px-icon-btn"
          style={{ width: 34, height: 34 }}
        >
          <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
        </button>

        <div className="px-search-bar">
          <Search className="w-[18px] h-[18px] shrink-0" style={{ color: 'var(--dim)' }} />
          <input
            id="searchInput"
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch(searchTerm);
            }}
            placeholder="Search creators, #tags, sounds..."
            autoFocus
          />
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm('');
                setResults([]);
              }}
              className="shrink-0 cursor-pointer"
              style={{ color: 'var(--dim)' }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          onClick={() => handleSearch(searchTerm)}
          className="text-[12px] font-bold px-1 hover:opacity-80 cursor-pointer shrink-0"
          style={{ color: 'var(--red)' }}
        >
          Search
        </button>
      </div>

      {/* 2. BODY CONTENT */}
      {!searchTerm.trim() ? (
        /* VIEW A: RECENT SEARCHES & SUGGESTIONS */
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <div>
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-bold text-neutral-200">Recent searches</span>
                <button
                  onClick={() => {
                    setRecentSearches([]);
                    localStorage.removeItem('pulse_recent_searches');
                  }}
                  className="text-[11px] text-neutral-500 hover:text-neutral-300 cursor-pointer"
                >
                  Clear all
                </button>
              </div>

              <div className="space-y-1">
                {recentSearches.map((term, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSearch(term)}
                    className="flex items-center justify-between py-2 px-2 hover:bg-neutral-900 rounded-xl cursor-pointer group transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-3.5 h-3.5 text-neutral-400" />
                      <span className="text-xs text-neutral-300">{term}</span>
                    </div>
                    <button
                      onClick={(e) => handleRemoveRecent(term, e)}
                      className="text-neutral-500 hover:text-neutral-200 p-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trending Searches (real, from actual logged searches in the last 7 days) */}
          {trendingSearches.length > 0 && (
            <div>
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-bold text-neutral-200">Trending</span>
                <button
                  onClick={() => {
                    loadTrending();
                    onToast('Refreshed 🔄');
                  }}
                  className="hover:text-white text-neutral-400 cursor-pointer p-0.5"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2">
                {trendingSearches.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSearch(item.term)}
                    className="flex items-center justify-between py-2 hover:bg-neutral-900 rounded-xl px-2.5 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${item.isHot ? 'bg-[#fe2c55]' : 'bg-neutral-700'}`} />
                      <span className="text-xs text-neutral-300 font-medium">{item.term}</span>
                    </div>
                    {item.isHot && (
                      <span className="text-[10px] text-[#fe2c55] font-bold flex items-center gap-0.5">
                        <TrendingUp className="w-3 h-3" /> Trending
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Live Discovery (grid + swipeable feed) when anyone's broadcasting */}
          {activeLiveStreams.length > 0 && (
            <LiveDiscoveryGrid
              streams={activeLiveStreams}
              currentUser={currentUser}
              onEnterRoom={(stream) => onEnterLiveRoom(stream)}
              onRequireAuth={onRequireAuth}
            />
          )}

          {/* Popular Creators (fallback rail when nobody's live) */}
          {popularCreators.length > 0 && (
            <div>
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-[#fe2c55] animate-pulse" /> Popular Creators
                </span>
              </div>

              <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
                {popularCreators.map((creator) => (
                  <div
                    key={creator.uid}
                    onClick={() => onSelectUser(creator.handle, creator.uid)}
                    className="flex flex-col items-center cursor-pointer shrink-0 group"
                  >
                    <div className="relative">
                      <div className="w-14 h-14 rounded-full p-[2px] bg-gradient-to-tr from-[#25f4ee] to-[#fe2c55] group-hover:scale-105 transition-transform">
                        <img
                          src={creator.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${creator.uid}`}
                          alt={creator.username || creator.handle}
                          className="w-full h-full rounded-full object-cover border-2 border-black bg-neutral-900"
                        />
                      </div>
                      {creator.verified && (
                        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1 py-0.2 bg-[#25f4ee] text-black text-[8px] font-black rounded uppercase">
                          PRO
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-semibold text-neutral-300 mt-1.5 max-w-[64px] truncate text-center">
                      {creator.username || creator.handle}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* VIEW B: SEARCH RESULTS TABS & CLEAN REAL RESULTS */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs: Top | Users | Videos | Hashtags | Sounds */}
          <div className="flex border-b border-white/10 px-2 overflow-x-auto no-scrollbar shrink-0 bg-black">
            {(['top', 'users', 'videos', 'hashtags', 'sounds'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveFilter(tab)}
                className={`py-2 px-3 text-xs font-bold capitalize whitespace-nowrap relative cursor-pointer ${
                  activeFilter === tab ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {tab}
                {activeFilter === tab && (
                  <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-white rounded-full" />
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {searching ? (
              <div className="text-center py-12 text-xs text-neutral-400 animate-pulse">Searching creators and content...</div>
            ) : filteredResults.length === 0 ? (
              <div className="text-center py-12 text-xs text-neutral-400">
                No results found for "{searchTerm}".
              </div>
            ) : (
              <div className="space-y-4">
                {/* "Others searched for" pill grid — real trending terms, hidden if none yet */}
                {trendingSearches.length > 0 && (
                  <div className="bg-neutral-900 border border-white/10 rounded-2xl p-3">
                    <span className="text-[11px] font-bold text-neutral-400 block mb-2">Others searched for</span>
                    <div className="grid grid-cols-2 gap-2">
                      {trendingSearches.slice(0, 6).map((item, i) => (
                        <button
                          key={i}
                          onClick={() => handleSearch(item.term)}
                          className="py-1.5 px-3 bg-neutral-950 border border-white/10 rounded-xl text-left text-xs font-medium text-neutral-200 hover:border-white/30 truncate cursor-pointer"
                        >
                          {item.term}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Results List */}
                <div className="space-y-2.5">
                  {filteredResults.map((res) => {
                    if (res.type === 'user') {
                      const user = res.data as UserProfile | undefined;
                      const targetHandle = res.userHandle || res.handle || (user?.handle) || '@creator';
                      const targetUid = res.id;
                      const avatarUrl = res.userAvatar || res.avatar || user?.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + targetUid;

                      return (
                        <div
                          key={res.id}
                          onClick={() => onSelectUser(targetHandle, targetUid)}
                          className="bg-neutral-900/80 border border-white/10 hover:border-white/20 rounded-2xl p-3.5 flex items-center justify-between gap-3 cursor-pointer shadow-xs transition-all hover:bg-neutral-900"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div 
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectUser(targetHandle, targetUid);
                              }}
                              className="relative shrink-0 group"
                              title="View Profile"
                            >
                              <img
                                src={avatarUrl}
                                alt={res.title || targetHandle}
                                className="w-12 h-12 rounded-full object-cover border border-white/20 group-hover:scale-105 transition-transform"
                              />
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1">
                                <h4 className="text-xs font-extrabold text-white truncate">
                                  {res.title || user?.username || targetHandle}
                                </h4>
                                {(res.userVerified || user?.verified) && <VerifiedBadge size="xs" />}
                              </div>
                              <span className="text-[11px] text-neutral-400 font-mono block truncate">
                                {targetHandle}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-neutral-400 font-medium">
                                <span>{formatCount(res.followers || user?.followers || 0)} followers</span>
                                {user?.likesReceived ? (
                                  <>
                                    <span>•</span>
                                    <span>{formatCount(user.likesReceived)} likes</span>
                                  </>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons: Chat & View Profile */}
                          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            {onOpenChat && (
                              <button
                                onClick={() => onOpenChat({ uid: targetUid, handle: targetHandle, avatar: avatarUrl })}
                                className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors border border-white/5"
                                title="Send message"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline text-[11px]">Chat</span>
                              </button>
                            )}

                            <button
                              onClick={() => onSelectUser(targetHandle, targetUid)}
                              className="px-3 py-1.5 bg-[#fe2c55] hover:bg-[#e0244a] text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs"
                            >
                              Profile
                            </button>
                          </div>
                        </div>
                      );
                    }

                    if (res.type === 'tag') {
                      return (
                        <div
                          key={res.id}
                          onClick={() => {
                            if (onSelectTag) onSelectTag(res.title?.replace('#', '') || res.handle.replace('#', ''));
                            onClose();
                          }}
                          className="bg-neutral-900/80 border border-white/10 hover:border-white/20 rounded-2xl p-3 flex items-center justify-between cursor-pointer hover:bg-neutral-900"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-white font-extrabold text-sm shrink-0 border border-white/10">
                              #
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-white truncate">{res.title || res.handle}</h4>
                              <span className="text-[10px] text-neutral-400">Explore viral videos with this hashtag</span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-neutral-500 shrink-0" />
                        </div>
                      );
                    }

                    if (res.type === 'sound') {
                      return (
                        <div
                          key={res.id}
                          onClick={() => onToast(`Audio: ${res.title || res.handle}`)}
                          className="bg-neutral-900/80 border border-white/10 hover:border-white/20 rounded-2xl p-3 flex items-center justify-between cursor-pointer hover:bg-neutral-900"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-neutral-800 text-white flex items-center justify-center shrink-0 border border-white/10">
                              <Music className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-white truncate">{res.title || res.handle}</h4>
                              <span className="text-[10px] text-neutral-400">Original sound track</span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-neutral-500 shrink-0" />
                        </div>
                      );
                    }

                    // Video item
                    const vid = res.videoData;
                    return (
                      <div
                        key={res.id}
                        onClick={() => {
                          if (vid && onSelectVideo) {
                            onSelectVideo(vid);
                            onClose();
                          } else {
                            onToast(`Playing video`);
                          }
                        }}
                        className="bg-neutral-900 rounded-2xl overflow-hidden aspect-[16/9] sm:aspect-[3/4] relative cursor-pointer group border border-white/10"
                      >
                        <video
                          src={vid?.src}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform opacity-90"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-3">
                          <p className="text-xs text-white font-bold line-clamp-2">{res.title}</p>
                          <div className="flex items-center justify-between text-[10px] text-neutral-300 font-medium mt-1">
                            <span>{res.subtitle}</span>
                            <span className="flex items-center gap-1 font-bold text-white">
                              <Play className="w-2.5 h-2.5 fill-white" />
                              {formatCount(vid?.likeCount || 0)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
