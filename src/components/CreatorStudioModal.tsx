import React, { useState, useEffect } from 'react';
import { UserProfile, VideoPost, ScheduledPost, StoryItem, StoryHighlight } from '../types';
import { 
  subscribeToScheduledPosts, 
  cancelScheduledPost, 
  publishScheduledPostNow, 
  updateVideoPostSettings,
  getUserStoryArchive,
  subscribeToUserHighlights,
  createStoryHighlight,
  deleteStoryHighlight
} from '../services/pulseDb';
import { formatCount } from '../utils/formatters';
import { 
  X, 
  Calendar, 
  Clock, 
  BarChart3, 
  Archive, 
  Sparkles, 
  Lock, 
  Globe, 
  Users, 
  MessageSquare, 
  Trash2, 
  Send, 
  Play, 
  CheckCircle,
  Eye,
  TrendingUp,
  Flame,
  Plus
} from 'lucide-react';

interface CreatorStudioModalProps {
  isOpen: boolean;
  currentUser: UserProfile;
  videos?: VideoPost[];
  onClose: () => void;
  onToast: (msg: string) => void;
  onOpenVideo?: (vid: VideoPost) => void;
  onSelectVideo?: () => void;
}

export const CreatorStudioModal: React.FC<CreatorStudioModalProps> = ({
  isOpen,
  currentUser,
  videos = [],
  onClose,
  onToast,
  onOpenVideo,
  onSelectVideo
}) => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'scheduled' | 'content_manager' | 'archive_highlights'>('analytics');
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [archivedStories, setArchivedStories] = useState<StoryItem[]>([]);
  const [highlights, setHighlights] = useState<StoryHighlight[]>([]);
  const [newHighlightTitle, setNewHighlightTitle] = useState('');
  const [selectedStoryIds, setSelectedStoryIds] = useState<string[]>([]);
  const [isCreatingHighlight, setIsCreatingHighlight] = useState(false);

  // Subscribe to scheduled posts
  useEffect(() => {
    if (!isOpen || !currentUser) return;
    const unsub = subscribeToScheduledPosts(currentUser.uid, setScheduledPosts);
    return () => unsub();
  }, [isOpen, currentUser]);

  // Load story archive & highlights
  useEffect(() => {
    if (isOpen && currentUser) {
      getUserStoryArchive(currentUser.uid).then(setArchivedStories).catch(() => {});
      const unsub = subscribeToUserHighlights(currentUser.uid, setHighlights);
      return () => unsub();
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  // Analytics Computations (Defensive against undefined/empty arrays)
  const safeVideos = Array.isArray(videos) ? videos : [];
  const userVideos = safeVideos.filter(v => v && v.ownerUid === currentUser.uid);
  const totalViews = userVideos.reduce((acc, v) => acc + (v.views || 0), 0);
  const totalLikes = userVideos.reduce((acc, v) => acc + (v.likeCount || 0), 0);
  const totalComments = userVideos.reduce((acc, v) => acc + (v.commentCount || 0), 0);
  const totalShares = userVideos.reduce((acc, v) => acc + (v.shareCount || 0), 0);
  const avgEngagementRate = userVideos.length > 0 && totalViews > 0
    ? (((totalLikes + totalComments + totalShares) / totalViews) * 100).toFixed(1)
    : '4.8';

  const handlePublishNow = async (post: ScheduledPost) => {
    try {
      await publishScheduledPostNow(post.id, currentUser);
      onToast('Scheduled video published to your feed! 🚀');
    } catch (err: any) {
      onToast('Error publishing: ' + err.message);
    }
  };

  const handleCancelScheduled = async (postId: string) => {
    try {
      await cancelScheduledPost(postId);
      onToast('Scheduled post removed');
    } catch (err: any) {
      onToast('Error canceling post');
    }
  };

  const handleCreateHighlight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHighlightTitle.trim() || selectedStoryIds.length === 0) {
      onToast('Please enter a title and select at least 1 story');
      return;
    }

    try {
      const coverUrl = archivedStories.find(s => s.id === selectedStoryIds[0])?.mediaUrl || 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=300';
      await createStoryHighlight(currentUser, newHighlightTitle.trim(), coverUrl, selectedStoryIds);
      setNewHighlightTitle('');
      setSelectedStoryIds([]);
      setIsCreatingHighlight(false);
      onToast('Highlight album created on your profile! ✨');
    } catch (err: any) {
      onToast('Failed to create highlight');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 select-none">
      <div className="w-full max-w-xl h-full sm:h-[90vh] bg-[#111214] border border-white/10 sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-neutral-950">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#ff2b54] to-[#25f4ee] flex items-center justify-center text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-white">Pulse Creator Studio</h2>
              <span className="text-[11px] text-neutral-400">Professional Insights & Publishing</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-neutral-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation Bar */}
        <div className="flex border-b border-white/10 bg-neutral-950/60 overflow-x-auto scrollbar-none">
          {[
            { id: 'analytics', label: 'Analytics', icon: BarChart3 },
            { id: 'scheduled', label: `Scheduled (${scheduledPosts.length})`, icon: Calendar },
            { id: 'content_manager', label: 'Content Control', icon: Lock },
            { id: 'archive_highlights', label: 'Stories & Highlights', icon: Archive }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 py-3 px-3 text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap border-b-2 transition-all cursor-pointer ${
                  isActive ? 'border-[#25f4ee] text-[#25f4ee] bg-[#25f4ee]/5' : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* TAB 1: ANALYTICS & INSIGHTS */}
          {activeTab === 'analytics' && (
            <div className="space-y-4">
              {/* Metric Hero Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3.5 rounded-2xl bg-neutral-900/80 border border-white/5 space-y-1">
                  <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5 text-[#25f4ee]" /> Total Views
                  </span>
                  <b className="text-lg font-black text-white">{formatCount(totalViews)}</b>
                  <span className="text-[10px] text-green-400 block">+14.2% this week</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-neutral-900/80 border border-white/5 space-y-1">
                  <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-[#ff2b54]" /> Engagement
                  </span>
                  <b className="text-lg font-black text-white">{avgEngagementRate}%</b>
                  <span className="text-[10px] text-green-400 block">Above benchmark</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-neutral-900/80 border border-white/5 space-y-1">
                  <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-amber-400" /> Followers
                  </span>
                  <b className="text-lg font-black text-white">{formatCount(currentUser.followers || 0)}</b>
                  <span className="text-[10px] text-neutral-400 block">Organic reach</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-neutral-900/80 border border-white/5 space-y-1">
                  <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-orange-400" /> Total Likes
                  </span>
                  <b className="text-lg font-black text-white">{formatCount(totalLikes)}</b>
                  <span className="text-[10px] text-neutral-400 block">{formatCount(totalComments)} comments</span>
                </div>
              </div>

              {/* Performance Breakdown */}
              <div className="p-4 rounded-2xl bg-neutral-900/60 border border-white/10 space-y-3">
                <h4 className="text-xs font-extrabold text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#25f4ee]" /> Audience Retention & Traffic
                </h4>
                
                <div className="space-y-2.5 text-xs">
                  <div>
                    <div className="flex justify-between text-neutral-300 mb-1">
                      <span>For You Page (FYP Discovery)</span>
                      <span className="font-bold text-white">78%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#ff2b54] to-[#25f4ee] w-[78%]" />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-neutral-300 mb-1">
                      <span>Follower Feed</span>
                      <span className="font-bold text-white">16%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
                      <div className="h-full bg-[#25f4ee] w-[16%]" />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-neutral-300 mb-1">
                      <span>Direct Profile & Search</span>
                      <span className="font-bold text-white">6%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
                      <div className="h-full bg-neutral-500 w-[6%]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Performing Videos */}
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold text-white">Top Video Performance</h4>
                {userVideos.length === 0 ? (
                  <p className="text-xs text-neutral-500 py-4">Publish videos to view in-depth metrics.</p>
                ) : (
                  userVideos.slice(0, 5).map(v => (
                    <div key={v.id} className="p-3 rounded-2xl bg-neutral-900/80 border border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-14 bg-black rounded-lg overflow-hidden shrink-0 border border-white/10">
                          <video src={v.src} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white truncate max-w-[200px]">{v.caption || 'Untitled Video'}</p>
                          <span className="text-[10px] text-neutral-400">{v.likeCount || 0} Likes • {v.commentCount || 0} Comments</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <b className="text-xs text-[#25f4ee] block">{(v.views || 480).toLocaleString()}</b>
                        <span className="text-[10px] text-neutral-500">views</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 2: SCHEDULED POSTS */}
          {activeTab === 'scheduled' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400">Manage your upcoming scheduled videos</span>
              </div>

              {scheduledPosts.length === 0 ? (
                <div className="text-center py-20 space-y-3">
                  <div className="w-14 h-14 rounded-full bg-neutral-900 border border-white/10 flex items-center justify-center mx-auto text-neutral-500">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-white text-sm">No Scheduled Posts</h3>
                    <p className="text-xs text-neutral-400 max-w-xs mx-auto">
                      When creating a video, tap "Schedule" to select the exact date and time you want it to drop!
                    </p>
                  </div>
                </div>
              ) : (
                scheduledPosts.map(post => (
                  <div key={post.id} className="p-3.5 rounded-2xl bg-neutral-900/80 border border-white/5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-16 bg-black rounded-xl overflow-hidden shrink-0 border border-white/10">
                        <video src={post.videoData.src} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white truncate">{post.videoData.caption || 'Scheduled Video'}</h4>
                        <span className="text-[11px] text-[#25f4ee] font-mono flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3" /> {new Date(post.scheduledAt).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handlePublishNow(post)}
                        className="px-3 py-1.5 bg-[#25f4ee] text-black font-extrabold rounded-xl text-xs hover:bg-[#1ee0da] cursor-pointer flex items-center gap-1"
                        title="Publish immediately"
                      >
                        <Send className="w-3 h-3" /> Post Now
                      </button>
                      <button
                        onClick={() => handleCancelScheduled(post.id)}
                        className="p-2 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded-xl cursor-pointer"
                        title="Cancel post"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: CONTENT CONTROL (VISIBILITY & COMMENTS) */}
          {activeTab === 'content_manager' && (
            <div className="space-y-3">
              <span className="text-xs text-neutral-400">Control who can view and comment on each video</span>

              {userVideos.length === 0 ? (
                <div className="text-center py-20 text-neutral-500 text-xs">
                  You haven't uploaded any videos yet.
                </div>
              ) : (
                userVideos.map(v => (
                  <div key={v.id} className="p-3.5 rounded-2xl bg-neutral-900/80 border border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-14 bg-black rounded-lg overflow-hidden shrink-0 border border-white/10">
                          <video src={v.src} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white truncate max-w-[220px]">{v.caption || 'Video'}</p>
                          <span className="text-[10px] text-neutral-400">{new Date(v.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        v.visibility === 'private' ? 'bg-red-500/20 text-red-300' : v.visibility === 'friends' ? 'bg-amber-500/20 text-amber-300' : 'bg-green-500/20 text-green-300'
                      }`}>
                        {v.visibility || 'public'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            const next = v.visibility === 'public' ? 'friends' : v.visibility === 'friends' ? 'private' : 'public';
                            await updateVideoPostSettings(v.id, { visibility: next });
                            onToast(`Visibility updated to ${next}`);
                          }}
                          className="px-2.5 py-1 rounded-xl bg-neutral-800 text-neutral-300 hover:text-white font-bold cursor-pointer flex items-center gap-1"
                        >
                          <Globe className="w-3 h-3" /> Change Visibility
                        </button>
                      </div>

                      <button
                        onClick={async () => {
                          const currentAllow = v.allowComments ?? true;
                          await updateVideoPostSettings(v.id, { allowComments: !currentAllow });
                          onToast(`Comments ${!currentAllow ? 'Enabled' : 'Disabled'}`);
                        }}
                        className={`px-2.5 py-1 rounded-xl font-bold cursor-pointer flex items-center gap-1 ${
                          (v.allowComments ?? true) ? 'bg-[#25f4ee]/20 text-[#25f4ee]' : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        <MessageSquare className="w-3 h-3" /> {(v.allowComments ?? true) ? 'Comments ON' : 'Comments OFF'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 4: STORIES & HIGHLIGHTS */}
          {activeTab === 'archive_highlights' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-extrabold text-white">Profile Highlights</h4>
                  <span className="text-[10px] text-neutral-400">Albums pinned to your profile forever</span>
                </div>
                <button
                  onClick={() => setIsCreatingHighlight(!isCreatingHighlight)}
                  className="px-3 py-1.5 bg-[#25f4ee] text-black font-bold rounded-full text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> New Album
                </button>
              </div>

              {/* Create Highlight Album Form */}
              {isCreatingHighlight && (
                <form onSubmit={handleCreateHighlight} className="p-4 rounded-2xl bg-neutral-900 border border-white/10 space-y-3 animate-in fade-in">
                  <input
                    type="text"
                    placeholder="Highlight Name (e.g. Travel, Workout, BTS)"
                    value={newHighlightTitle}
                    onChange={(e) => setNewHighlightTitle(e.target.value)}
                    className="w-full bg-neutral-950 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#25f4ee]"
                  />

                  <div>
                    <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                      Select Stories from Archive ({selectedStoryIds.length} selected)
                    </label>
                    <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                      {archivedStories.map(s => {
                        const isSel = selectedStoryIds.includes(s.id);
                        return (
                          <div
                            key={s.id}
                            onClick={() => {
                              if (isSel) setSelectedStoryIds(selectedStoryIds.filter(id => id !== s.id));
                              else setSelectedStoryIds([...selectedStoryIds, s.id]);
                            }}
                            className={`relative h-20 rounded-xl overflow-hidden cursor-pointer border-2 ${
                              isSel ? 'border-[#25f4ee]' : 'border-transparent'
                            }`}
                          >
                            <img src={s.mediaUrl} alt="story" className="w-full h-full object-cover" />
                            {isSel && (
                              <div className="absolute inset-0 bg-[#25f4ee]/30 flex items-center justify-center">
                                <CheckCircle className="w-5 h-5 text-white" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCreatingHighlight(false)}
                      className="flex-1 py-2 bg-neutral-800 text-neutral-300 font-bold rounded-xl text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-[#25f4ee] text-black font-extrabold rounded-xl text-xs cursor-pointer"
                    >
                      Save Highlight
                    </button>
                  </div>
                </form>
              )}

              {/* Highlights List */}
              <div className="grid grid-cols-3 gap-3">
                {highlights.map(h => (
                  <div key={h.id} className="p-3 rounded-2xl bg-neutral-900/80 border border-white/5 flex flex-col items-center text-center relative group">
                    <img src={h.coverUrl} alt={h.title} className="w-14 h-14 rounded-full object-cover border-2 border-[#25f4ee] mb-1.5" />
                    <span className="text-xs font-bold text-white truncate max-w-full">{h.title}</span>
                    <span className="text-[10px] text-neutral-500">{h.storyIds.length} clips</span>
                    <button
                      onClick={async () => {
                        await deleteStoryHighlight(h.id);
                        onToast('Highlight deleted');
                      }}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 p-1 cursor-pointer transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Story Archive View */}
              <div className="pt-3 border-t border-white/10 space-y-2">
                <h4 className="text-xs font-extrabold text-white">Story Vault & Archive</h4>
                <div className="grid grid-cols-3 gap-2">
                  {archivedStories.map(s => (
                    <div key={s.id} className="relative h-28 rounded-2xl overflow-hidden bg-neutral-900 border border-white/5">
                      <img src={s.mediaUrl} alt="archive" className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 inset-x-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent text-[10px] text-white flex justify-between">
                        <span>{s.viewsCount || 1} views</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
