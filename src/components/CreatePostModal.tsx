import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, VideoDraft } from '../types';
import { createVideoPost, createStory, getLocalDrafts, saveLocalDraft, deleteLocalDraft, scheduleVideoPost } from '../services/pulseDb';
import { 
  X, 
  Upload, 
  Check, 
  Music, 
  Hash, 
  Camera, 
  RefreshCw, 
  Bookmark, 
  Sparkles, 
  RotateCcw, 
  FolderOpen, 
  Image as ImageIcon,
  Trash2,
  Sliders,
  Type,
  Mic,
  MicOff,
  Volume2,
  Lock,
  Globe,
  Users,
  MessageSquare,
  Radio,
  Clock,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Aperture
} from 'lucide-react';

interface CreatePostModalProps {
  isOpen: boolean;
  currentUser: UserProfile;
  onClose: () => void;
  onPostCreated: () => void;
  onToast: (msg: string) => void;
  onOpenLiveStream?: () => void;
  // When the modal is opened from a "Add to Story" entry point (the Stories
  // Bar plus-button), it should default to Story mode rather than silently
  // defaulting to Feed Post — otherwise a story upload posts to the normal
  // feed unless the person notices and manually flips the toggle.
  initialPostType?: 'feed' | 'story';
}

const POPULAR_TAGS = ['fyp', 'pulse', 'trending', 'viral', 'lifestyle', 'creative', 'music', 'tech', 'dance', 'comedy', 'photo'];

const VIDEO_FILTERS = [
  { id: 'none', label: 'Original', class: '' },
  { id: 'vivid', label: 'Vivid Glow', class: 'saturate-150 contrast-110 brightness-105' },
  { id: 'cyberpunk', label: 'Cyberpunk', class: 'hue-rotate-180 contrast-125 saturate-150' },
  { id: 'vintage', label: 'Vintage', class: 'sepia contrast-110 brightness-95' },
  { id: 'noir', label: 'Film Noir', class: 'grayscale contrast-150' },
  { id: 'neon', label: 'Tokyo Neon', class: 'contrast-125 saturate-200 brightness-110' },
  { id: 'sunset', label: 'Sunset', class: 'sepia-50 saturate-150 hue-rotate-15' }
];

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onPostCreated,
  onToast,
  onOpenLiveStream,
  initialPostType
}) => {
  const [step, setStep] = useState<'choose' | 'record' | 'compose' | 'drafts'>('choose');
  const [postType, setPostType] = useState<'feed' | 'story'>('feed');
  const [mediaType, setMediaType] = useState<'video' | 'image' | 'carousel'>('video');
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [activeImageIdx, setActiveImageIdx] = useState<number>(0);
  const [videoFileName, setVideoFileName] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [sound, setSound] = useState(`Original sound — ${currentUser.username}`);
  const [selectedTags, setSelectedTags] = useState<string[]>(['fyp', 'pulse']);
  const [customTag, setCustomTag] = useState('');
  const [coverUrl, setCoverUrl] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('none');
  
  // Advanced Editor States
  const [textOverlay, setTextOverlay] = useState<{ text: string; color: string; fontSize: number; position: 'top' | 'center' | 'bottom' } | null>(null);
  const [overlayTextVal, setOverlayTextVal] = useState('');
  const [overlayColor, setOverlayColor] = useState('#ffffff');
  const [overlayPosition, setOverlayPosition] = useState<'top' | 'center' | 'bottom'>('center');
  const [showTextEditor, setShowTextEditor] = useState(false);

  // Audio & Voiceover
  const [voiceoverSrc, setVoiceoverSrc] = useState<string>('');
  const [isRecordingVoiceover, setIsRecordingVoiceover] = useState(false);
  const [voiceoverDuration, setVoiceoverDuration] = useState(0);
  const [musicVolume, setMusicVolume] = useState<number>(100);
  const [originalVolume, setOriginalVolume] = useState<number>(100);

  // Privacy & Settings
  const [visibility, setVisibility] = useState<'public' | 'friends' | 'private'>('public');
  const [allowComments, setAllowComments] = useState(true);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState('');

  // Upload feedback
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [draftsList, setDraftsList] = useState<VideoDraft[]>([]);
  const [generatingAICaption, setGeneratingAICaption] = useState(false);
  const [generatingAITags, setGeneratingAITags] = useState(false);

  // Camera Recording States
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const recordingTimerRef = useRef<any>(null);

  // Voiceover Recorder Refs
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceTimerRef = useRef<any>(null);

  // File Input Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setStep('choose');
      setPostType('feed');
      setMediaType('video');
      setVideoSrc('');
      setImageUrls([]);
      setActiveImageIdx(0);
      setVideoFileName('');
      setCaption('');
      setCoverUrl('');
      setActiveFilter('none');
      setTextOverlay(null);
      setVoiceoverSrc('');
      setUploadError(null);
      setUploadProgress(0);
      stopCamera();
    } else {
      setPostType(initialPostType || 'feed');
      setDraftsList(getLocalDrafts());
    }
  }, [isOpen, initialPostType]);

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    setIsRecording(false);
    setRecordingTime(0);
  };

  const startCamera = async (overrideFacing?: 'user' | 'environment') => {
    const facing = overrideFacing || cameraFacing;
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: true
      });
      mediaStreamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
      }
      setStep('record');
    } catch (err: any) {
      console.error('Camera error:', err);
      onToast('Camera access not granted or unavailable on this device.');
    }
  };

  const handleFlipCamera = async () => {
    const nextFacing = cameraFacing === 'user' ? 'environment' : 'user';
    setCameraFacing(nextFacing);
    await startCamera(nextFacing);
    onToast(`Switched to ${nextFacing === 'user' ? 'front' : 'rear'} camera`);
  };

  const handleSnapPhoto = () => {
    if (!videoPreviewRef.current) return;
    try {
      const vid = videoPreviewRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = vid.videoWidth || 720;
      canvas.height = vid.videoHeight || 1280;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        setVideoSrc(dataUrl);
        setImageUrls([dataUrl]);
        setActiveImageIdx(0);
        setMediaType('image');
        setCoverUrl(dataUrl);
        setVideoFileName('Live Camera Snap');
        if (!caption) setCaption('Snapped on Pulse 📸');
        stopCamera();
        setStep('compose');
        onToast('Photo captured successfully! 📸');
      }
    } catch (e) {
      onToast('Could not capture frame from camera.');
    }
  };

  const handleStartRecording = () => {
    if (!mediaStreamRef.current) return;
    recordedChunksRef.current = [];
    try {
      const recorder = new MediaRecorder(mediaStreamRef.current);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/mp4' });
        const reader = new FileReader();
        reader.onloadend = () => {
          setVideoSrc(reader.result as string);
          setMediaType('video');
          setImageUrls([]);
          setVideoFileName('Live Camera Recording');
          extractFrameThumbnail(reader.result as string);
          stopCamera();
          setStep('compose');
        };
        reader.readAsDataURL(blob);
      };

      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(t => {
          if (t >= 60) {
            handleStopRecording();
            return 60;
          }
          return t + 1;
        });
      }, 1000);
    } catch (e) {
      console.error('Recorder error:', e);
      onToast('Failed to record video stream.');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
  };

  const startVoiceoverRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      voiceRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) voiceChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(voiceChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          setVoiceoverSrc(reader.result as string);
          onToast('Voiceover attached successfully! 🎙️');
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start();
      setIsRecordingVoiceover(true);
      setVoiceoverDuration(0);

      voiceTimerRef.current = setInterval(() => {
        setVoiceoverDuration(d => d + 1);
      }, 1000);
    } catch (e) {
      onToast('Microphone access required for voiceover.');
    }
  };

  const stopVoiceoverRecording = () => {
    if (voiceRecorderRef.current && isRecordingVoiceover) {
      voiceRecorderRef.current.stop();
      setIsRecordingVoiceover(false);
      if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
    }
  };

  const extractFrameThumbnail = (videoDataUrl: string) => {
    try {
      const vid = document.createElement('video');
      vid.src = videoDataUrl;
      vid.crossOrigin = 'anonymous';
      vid.muted = true;
      vid.currentTime = 0.5;
      vid.onloadeddata = () => {
        const canvas = document.createElement('canvas');
        canvas.width = vid.videoWidth || 360;
        canvas.height = vid.videoHeight || 640;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
          const thumb = canvas.toDataURL('image/jpeg', 0.8);
          setCoverUrl(thumb);
        }
      };
    } catch (e) {}
  };

  const processSelectedFiles = (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    if (!fileArr.length) return;

    const firstFile = fileArr[0];
    const isImage = firstFile.type.startsWith('image/');
    const isVideo = firstFile.type.startsWith('video/');

    if (!isImage && !isVideo) {
      onToast('Please select valid video or image files (MP4, MOV, JPG, PNG, WEBP)');
      return;
    }

    if (isImage) {
      const promises = fileArr.filter(f => f.type.startsWith('image/')).map(f => {
        return new Promise<string>((resolve) => {
          const r = new FileReader();
          r.onload = (e) => resolve(e.target?.result as string || '');
          r.readAsDataURL(f);
        });
      });

      Promise.all(promises).then(urls => {
        const valid = urls.filter(Boolean);
        if (!valid.length) return;
        setImageUrls(valid);
        setActiveImageIdx(0);
        setVideoSrc(valid[0]);
        setCoverUrl(valid[0]);
        setMediaType(valid.length > 1 ? 'carousel' : 'image');
        setVideoFileName(valid.length > 1 ? `${valid.length} Photos` : firstFile.name);
        const nameWithoutExt = firstFile.name.replace(/\.[^/.]+$/, '');
        if (!caption) setCaption(nameWithoutExt);
        setStep('compose');
        onToast(valid.length > 1 ? `${valid.length} photos ready for carousel!` : 'Photo loaded!');
      });
    } else {
      // Video
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const res = event.target.result as string;
          setVideoSrc(res);
          setImageUrls([]);
          setMediaType('video');
          setVideoFileName(firstFile.name);
          const nameWithoutExt = firstFile.name.replace(/\.[^/.]+$/, '');
          if (!caption) setCaption(nameWithoutExt);
          extractFrameThumbnail(res);
          setStep('compose');
          onToast('Video ready for studio editing!');
        }
      };
      reader.readAsDataURL(firstFile);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) processSelectedFiles(files);
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setCoverUrl(event.target.result as string);
        onToast('Custom cover frame loaded!');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) processSelectedFiles(files);
  };

  const handleToggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleAddCustomTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && customTag.trim()) {
      e.preventDefault();
      const cleaned = customTag.trim().replace(/^#/, '').toLowerCase();
      if (cleaned && !selectedTags.includes(cleaned)) {
        setSelectedTags([...selectedTags, cleaned]);
      }
      setCustomTag('');
    }
  };

  const handleSaveDraft = () => {
    if (!videoSrc) return;
    const draft: VideoDraft = {
      id: 'draft_' + Date.now(),
      src: videoSrc,
      caption,
      sound,
      tags: selectedTags,
      coverUrl,
      updatedAt: Date.now()
    };
    saveLocalDraft(draft);
    setDraftsList(getLocalDrafts());
    onToast('Draft saved securely to your device 📁');
  };

  const handleLoadDraft = (draft: VideoDraft) => {
    setVideoSrc(draft.src);
    setCaption(draft.caption || '');
    setSound(draft.sound || `Original sound — ${currentUser.username}`);
    setSelectedTags(draft.tags || ['fyp', 'pulse']);
    setCoverUrl(draft.coverUrl || '');
    setMediaType(draft.src.startsWith('data:image') ? 'image' : 'video');
    setStep('compose');
    onToast('Draft restored to Studio!');
  };

  const handleDeleteDraft = (draftId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteLocalDraft(draftId);
    setDraftsList(getLocalDrafts());
    onToast('Draft deleted');
  };

  const handleApplyTextOverlay = () => {
    if (!overlayTextVal.trim()) {
      setTextOverlay(null);
    } else {
      setTextOverlay({
        text: overlayTextVal.trim(),
        color: overlayColor,
        fontSize: 22,
        position: overlayPosition
      });
    }
    setShowTextEditor(false);
  };

  const handleGenerateAICaption = async () => {
    setGeneratingAICaption(true);
    try {
      const res = await fetch('/api/groq/generate-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: caption || videoFileName || 'trending viral moment',
          style: 'viral & engaging with emojis and hooks',
          mediaType,
          tags: selectedTags
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.caption) {
          setCaption(data.caption);
          onToast('Groq AI generated a viral caption! ⚡️');
        }
      } else {
        onToast('AI caption generator ready.');
      }
    } catch (e) {
      console.warn('AI caption error:', e);
      onToast('Generated fallback caption.');
    } finally {
      setGeneratingAICaption(false);
    }
  };

  const handleSuggestAITags = async () => {
    setGeneratingAITags(true);
    try {
      const res = await fetch('/api/groq/suggest-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption: caption || 'Pulse video creator',
          category: 'lifestyle'
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.tags)) {
          const merged = Array.from(new Set([...selectedTags, ...data.tags])).slice(0, 10);
          setSelectedTags(merged);
          onToast('Groq AI added viral trending hashtags! ⚡️🔥');
        }
      }
    } catch (e) {
      console.warn('AI tags error:', e);
    } finally {
      setGeneratingAITags(false);
    }
  };

  const uploadMediaAsset = async (dataUrl: string): Promise<string> => {
    if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl;
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: dataUrl })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.url) return json.url;
      } else {
        const errJson = await res.json().catch(() => ({}));
        console.warn('Upload API responded with error:', errJson);
      }
    } catch (e) {
      console.warn('Backend upload notice:', e);
    }
    return dataUrl;
  };

  const handlePublish = async () => {
    if (!videoSrc && imageUrls.length === 0) {
      onToast('Please select or record media first.');
      return;
    }

    setLoading(true);
    setUploadError(null);
    setUploadProgress(20);
    setUploadStatusText('Preparing media asset...');

    try {
      // 1. Upload video / main media if base64
      let finalVideoSrc = videoSrc;
      if (videoSrc && videoSrc.startsWith('data:')) {
        setUploadProgress(40);
        setUploadStatusText(mediaType === 'video' ? 'Uploading & processing high-definition video...' : 'Uploading photo asset...');
        finalVideoSrc = await uploadMediaAsset(videoSrc);
      }

      // 2. Upload photo carousel items if base64
      let finalImageUrls: string[] = [];
      if (imageUrls && imageUrls.length > 0) {
        setUploadProgress(60);
        setUploadStatusText('Uploading photo carousel assets...');
        finalImageUrls = await Promise.all(imageUrls.map(img => uploadMediaAsset(img)));
      } else if (finalVideoSrc) {
        finalImageUrls = [finalVideoSrc];
      }

      // 3. Upload custom cover if base64
      let finalCoverUrl = coverUrl;
      if (coverUrl && coverUrl.startsWith('data:')) {
        finalCoverUrl = await uploadMediaAsset(coverUrl);
      }

      // 4. Upload voiceover if recorded
      let finalVoiceoverSrc = voiceoverSrc;
      if (voiceoverSrc && voiceoverSrc.startsWith('data:')) {
        finalVoiceoverSrc = await uploadMediaAsset(voiceoverSrc);
      }

      setUploadProgress(85);
      setUploadStatusText(postType === 'story' ? 'Dispatched to 24h Pulse Stories...' : 'Publishing to Pulse network...');

      if (postType === 'story') {
        await createStory(currentUser, finalVideoSrc, mediaType === 'video' ? 'video' : 'image', caption.trim());
        onToast('Story shared with friends! ⚡️');
      } else if (isScheduled && scheduledDateTime) {
        const scheduledTimestamp = new Date(scheduledDateTime).getTime();
        await scheduleVideoPost(currentUser, {
          src: finalVideoSrc,
          mediaType,
          images: finalImageUrls,
          coverUrl: finalCoverUrl || finalVideoSrc,
          caption: caption.trim() || (mediaType === 'image' ? 'New photo on Pulse ✨' : 'New video on Pulse ✨'),
          sound: sound.trim() || `Original sound — ${currentUser.username}`,
          tags: selectedTags,
          user: currentUser,
          filter: activeFilter,
          textOverlay: textOverlay || undefined,
          voiceoverSrc: finalVoiceoverSrc || undefined,
          musicVolume,
          originalVolume,
          visibility,
          allowComments
        }, scheduledTimestamp);
        onToast('Post successfully scheduled! Check Creator Studio 📅');
      } else {
        await createVideoPost({
          src: finalVideoSrc,
          mediaType,
          images: finalImageUrls,
          coverUrl: finalCoverUrl || finalVideoSrc,
          caption: caption.trim() || (mediaType === 'image' ? 'New photo on Pulse ✨' : 'New video on Pulse ✨'),
          sound: sound.trim() || `Original sound — ${currentUser.username}`,
          tags: selectedTags,
          user: currentUser,
          filter: activeFilter,
          textOverlay: textOverlay || undefined,
          voiceoverSrc: finalVoiceoverSrc || undefined,
          musicVolume,
          originalVolume,
          visibility,
          allowComments
        });
        onToast(mediaType === 'image' || mediaType === 'carousel' ? 'Photo published to feed! 📸' : 'Video published to feed! 🎉');
      }

      setUploadProgress(100);
      setUploadStatusText('Completed!');
      onPostCreated();
      onClose();
    } catch (err: any) {
      console.error('Publish error:', err);
      setUploadError(err.message || 'Failed to upload media');
      onToast('Failed to post: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentFilterClass = VIDEO_FILTERS.find(f => f.id === activeFilter)?.class || '';

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center animate-in fade-in select-none">
      <div className="relative w-full max-w-[480px] h-[100dvh] bg-black text-white flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-3.5 border-b border-white/10 shrink-0 bg-neutral-950/90">
          <div className="flex items-center gap-2">
            {step !== 'choose' && (
              <button
                onClick={() => {
                  if (step === 'record') stopCamera();
                  setStep('choose');
                }}
                className="p-1 rounded-full text-neutral-400 hover:text-white cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <h2 className="font-extrabold text-sm text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#25f4ee]" />
              {step === 'choose' && 'Create & Upload'}
              {step === 'record' && 'Camera & Live Studio'}
              {step === 'compose' && (mediaType === 'image' || mediaType === 'carousel' ? 'Photo Studio' : 'Video Studio')}
              {step === 'drafts' && 'Saved Drafts'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-neutral-900 border border-white/10 text-neutral-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        {step !== 'compose' && (
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
          {/* STEP 1: Direct File Upload or Camera */}
          {step === 'choose' && (
            <div className="flex flex-col gap-2.5">
              {/* Direct Drag and Drop File Upload (Supports Video + Images) */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                  isDragOver
                    ? 'border-[#25f4ee] bg-[#25f4ee]/10'
                    : 'border-white/20 hover:border-[#25f4ee]/60 bg-neutral-900/90 hover:bg-neutral-900'
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-[#ff2b54]/20 text-[#ff2b54] flex items-center justify-center mb-1.5">
                  <Upload className="w-4.5 h-4.5" />
                </div>
                <h3 className="text-xs font-bold text-white mb-0.5">
                  Upload Videos or Photos
                </h3>
                <p className="text-[10.5px] text-neutral-400 max-w-[240px] mb-2 leading-tight">
                  Select MP4, MOV videos or JPG, PNG, WEBP photos from your gallery or files.
                </p>
                <span className="text-[9px] font-semibold text-[#25f4ee] px-2 py-0.5 bg-[#25f4ee]/10 border border-[#25f4ee]/30 rounded-full">
                  Videos &bull; Photos &bull; Carousels
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*,image/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {/* Record with Camera directly (Video & Photo Snapshot) */}
              <div
                onClick={() => startCamera()}
                className="bg-neutral-900 hover:bg-neutral-800 border border-white/10 hover:border-[#25f4ee]/50 rounded-xl p-2.5 flex items-center gap-2.5 cursor-pointer transition-all active:scale-[0.99]"
              >
                <div className="w-8 h-8 rounded-full bg-[#25f4ee]/20 text-[#25f4ee] flex items-center justify-center shrink-0">
                  <Camera className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <b className="text-xs text-white block leading-tight">Camera Studio (Front &amp; Rear)</b>
                  <span className="text-[10px] text-neutral-400 block leading-tight mt-0.5">Record HD videos or snap instant live photos with mic</span>
                </div>
              </div>

              {/* Go LIVE Studio Broadcast Stream */}
              <div
                onClick={() => {
                  onClose();
                  if (onOpenLiveStream) {
                    onOpenLiveStream();
                  } else {
                    onToast('Opening LIVE Studio...');
                  }
                }}
                className="bg-gradient-to-r from-red-950/40 via-neutral-900 to-neutral-900 hover:from-red-950/60 border border-[#fe2c55]/40 hover:border-[#fe2c55] rounded-xl p-2.5 flex items-center justify-between cursor-pointer transition-all active:scale-[0.99] group shadow-sm"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#fe2c55]/20 text-[#fe2c55] flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                    <Radio className="w-4 h-4 animate-pulse" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <b className="text-xs text-white block leading-tight">Go LIVE Studio</b>
                      <span className="px-1.5 py-0.2 rounded-md bg-[#fe2c55] text-white text-[8px] font-black uppercase tracking-wider animate-pulse">
                        LIVE
                      </span>
                    </div>
                    <span className="text-[10px] text-neutral-400 block leading-tight mt-0.5 truncate">
                      Broadcast real-time video stream with live chat &amp; gifts
                    </span>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-[#fe2c55] text-white font-bold text-[10px] rounded-lg shadow-xs group-hover:brightness-110 transition-all shrink-0">
                  Go LIVE →
                </span>
              </div>

              {/* Drafts access */}
              {draftsList.length > 0 && (
                <div
                  onClick={() => setStep('drafts')}
                  className="bg-neutral-900/60 hover:bg-neutral-800 border border-white/10 rounded-2xl p-3 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2 text-neutral-300 text-xs">
                    <FolderOpen className="w-4 h-4 text-[#25f4ee]" />
                    <span>You have <b>{draftsList.length}</b> saved drafts</span>
                  </div>
                  <span className="text-xs text-[#25f4ee] font-bold">Open →</span>
                </div>
              )}
            </div>
          )}

          {/* DRAFTS DRAWER */}
          {step === 'drafts' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-neutral-300">Saved Drafts</span>
                <button
                  onClick={() => setStep('choose')}
                  className="text-xs text-[#25f4ee] hover:underline cursor-pointer"
                >
                  ← Back to upload
                </button>
              </div>

              {draftsList.map((draft) => (
                <div
                  key={draft.id}
                  onClick={() => handleLoadDraft(draft)}
                  className="flex items-center justify-between p-3 bg-neutral-900 border border-white/10 hover:border-[#25f4ee]/40 rounded-2xl cursor-pointer group transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-16 bg-black rounded-lg overflow-hidden border border-white/10 shrink-0">
                      {draft.src.startsWith('data:image') ? (
                        <img src={draft.src} className="w-full h-full object-cover" />
                      ) : (
                        <video src={draft.src} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div>
                      <b className="text-xs text-white block truncate max-w-[180px]">
                        {draft.caption || 'Untitled Draft'}
                      </b>
                      <span className="text-[10px] text-neutral-400 block mt-0.5">
                        {new Date(draft.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleDeleteDraft(draft.id, e)}
                      className="p-2 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-3 py-1 bg-[#25f4ee] text-black font-extrabold text-xs rounded-lg">
                      Edit
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* STEP 1.5: Camera Live Recording & Photo Snapshot */}
          {step === 'record' && (
            <div className="flex flex-col h-full items-center justify-between">
              <div className="relative w-full flex-1 bg-black rounded-2xl overflow-hidden border border-white/10 shadow-inner">
                <video
                  ref={videoPreviewRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {isRecording && (
                  <div className="absolute top-3 left-3 bg-red-600 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1.5 animate-pulse shadow">
                    <span className="w-2 h-2 rounded-full bg-white" />
                    REC {recordingTime}s / 60s
                  </div>
                )}
              </div>

              {/* Camera Controls - Compact, 70% reduced & well-arranged */}
              <div className="flex items-center justify-center gap-3.5 mt-3 pb-1 w-full">
                {/* Exit / Cancel */}
                <button
                  onClick={() => {
                    stopCamera();
                    setStep('choose');
                  }}
                  className="w-7 h-7 rounded-full bg-neutral-900/90 border border-white/15 text-neutral-400 hover:text-white flex items-center justify-center transition-transform active:scale-90 cursor-pointer shrink-0"
                  title="Cancel & return"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                {/* Snap Photo (Aperture) */}
                {!isRecording && (
                  <button
                    onClick={handleSnapPhoto}
                    className="w-7.5 h-7.5 rounded-full bg-neutral-900/90 border border-[#25f4ee]/40 hover:border-[#25f4ee] text-[#25f4ee] flex items-center justify-center shadow-xs transition-transform active:scale-90 cursor-pointer shrink-0"
                    title="Snap instant photo"
                  >
                    <Aperture className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Record Video Button (Sleek compact shutter) */}
                {!isRecording ? (
                  <button
                    onClick={handleStartRecording}
                    className="w-9 h-9 rounded-full p-0.5 border-2 border-white/90 bg-neutral-950 flex items-center justify-center shadow-md active:scale-95 transition-all cursor-pointer shrink-0"
                    title="Tap to record video"
                  >
                    <div className="w-6.5 h-6.5 rounded-full bg-[#ff2b54] flex items-center justify-center shadow-inner">
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                  </button>
                ) : (
                  <button
                    onClick={handleStopRecording}
                    className="w-9 h-9 rounded-full p-0.5 border-2 border-white bg-neutral-950 flex items-center justify-center shadow-md active:scale-95 transition-all cursor-pointer shrink-0 animate-pulse"
                    title="Stop recording"
                  >
                    <div className="w-6.5 h-6.5 rounded-full bg-red-600 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-[2px] bg-white" />
                    </div>
                  </button>
                )}

                {/* Flip Camera (Front / Rear) */}
                <button
                  onClick={handleFlipCamera}
                  disabled={isRecording}
                  className="w-7.5 h-7.5 rounded-full bg-neutral-900/90 border border-white/15 hover:border-[#25f4ee]/50 text-neutral-300 hover:text-[#25f4ee] flex items-center justify-center transition-transform active:scale-90 cursor-pointer disabled:opacity-40 shrink-0"
                  title="Flip camera"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Sleek Segmented Mode Switcher */}
              <div className="flex items-center justify-center pt-2 pb-1">
                <div className="bg-neutral-900/90 border border-white/10 p-0.5 rounded-full inline-flex items-center gap-1 shadow-inner">
                  <span className="font-semibold text-white px-2.5 py-0.5 text-[10px] bg-white/15 rounded-full flex items-center gap-1">
                    <Camera className="w-3 h-3 text-[#25f4ee]" /> Camera
                  </span>
                  <button
                    onClick={() => {
                      stopCamera();
                      onClose();
                      if (onOpenLiveStream) onOpenLiveStream();
                    }}
                    className="font-bold text-[#fe2c55] hover:text-white px-2.5 py-0.5 text-[10px] hover:bg-[#fe2c55] rounded-full flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Radio className="w-2.5 h-2.5 animate-pulse" /> LIVE
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        {/* STEP 2: Composer & Media Studio — full-screen, TikTok-style editor */}
        {step === 'compose' && (
          <div className="flex-1 relative overflow-hidden bg-black">
            {/* Full-bleed media background — object-contain everywhere so nothing crops/zooms */}
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              {mediaType === 'image' || mediaType === 'carousel' ? (
                <img
                  src={imageUrls[activeImageIdx] || videoSrc}
                  alt="Preview"
                  className={`w-full h-full object-contain bg-black ${currentFilterClass}`}
                />
              ) : (
                <video
                  src={videoSrc}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className={`w-full h-full object-contain bg-black ${currentFilterClass}`}
                />
              )}

              {/* Carousel Navigation Arrows if multiple photos */}
              {mediaType === 'carousel' && imageUrls.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveImageIdx(i => (i > 0 ? i - 1 : imageUrls.length - 1))}
                    className="absolute left-2 p-2 bg-black/60 rounded-full text-white cursor-pointer hover:bg-black/80 z-10"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveImageIdx(i => (i < imageUrls.length - 1 ? i + 1 : 0))}
                    className="absolute right-2 p-2 bg-black/60 rounded-full text-white cursor-pointer hover:bg-black/80 z-10"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1 pointer-events-none z-10">
                    {imageUrls.map((_, idx) => (
                      <div
                        key={idx}
                        className={`w-1.5 h-1.5 rounded-full transition-all ${
                          activeImageIdx === idx ? 'bg-[#25f4ee] w-3' : 'bg-white/40'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* Text Overlay Render */}
              {textOverlay && (
                <div
                  className={`absolute inset-x-4 flex justify-center pointer-events-none ${
                    textOverlay.position === 'top'
                      ? 'top-4'
                      : textOverlay.position === 'bottom'
                      ? 'bottom-4'
                      : 'top-1/2 -translate-y-1/2'
                  }`}
                >
                  <div
                    className="px-3 py-1 rounded-xl bg-black/60 backdrop-blur-xs font-extrabold text-center drop-shadow-2xl"
                    style={{ color: textOverlay.color, fontSize: `${textOverlay.fontSize}px` }}
                  >
                    {textOverlay.text}
                  </div>
                </div>
              )}
            </div>

            {/* Destination Mode: Feed Post vs 24h Story — floating top overlay */}
            <div className="absolute top-3 inset-x-3 z-20 grid grid-cols-2 gap-2 bg-black/60 backdrop-blur-md p-1 rounded-2xl border border-white/10">
              <button
                type="button"
                onClick={() => setPostType('feed')}
                className={`py-1.5 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  postType === 'feed'
                    ? 'bg-[#25f4ee] text-black shadow'
                    : 'text-neutral-300 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" /> Feed Post
              </button>
              <button
                type="button"
                onClick={() => setPostType('story')}
                className={`py-1.5 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  postType === 'story'
                    ? 'bg-[#ff2b54] text-white shadow'
                    : 'text-neutral-300 hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5" /> 24h Story
              </button>
            </div>

            {/* Studio Quick Buttons over Preview */}
            <div className="absolute right-3 top-16 flex flex-col gap-2 z-20">
              <button
                type="button"
                onClick={() => setShowTextEditor(!showTextEditor)}
                className="p-2 rounded-full bg-black/60 backdrop-blur-md text-white border border-white/10 hover:bg-black/80 cursor-pointer shadow"
                title="Add Text"
              >
                <Type className="w-4 h-4 text-[#25f4ee]" />
              </button>
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="p-2 rounded-full bg-black/60 backdrop-blur-md text-white border border-white/10 hover:bg-black/80 cursor-pointer shadow"
                title="Cover Frame"
              >
                <ImageIcon className="w-4 h-4 text-[#ff2b54]" />
              </button>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                onChange={handleCoverUpload}
                className="hidden"
              />
            </div>

            {/* Bottom Sheet — filters, voiceover, caption, tags, privacy, publish */}
            <div className="absolute bottom-0 inset-x-0 z-20 max-h-[62%] flex flex-col bg-neutral-950/97 backdrop-blur-xl border-t border-white/15 rounded-t-3xl shadow-[0_-12px_40px_rgba(0,0,0,.6)]">
              {/* Drag handle — makes it visually obvious this is a distinct
                  sheet sitting on top of the video, not empty dead space. */}
              <div className="flex items-center justify-center pt-2 pb-1 shrink-0">
                <div className="w-9 h-1 rounded-full bg-white/20" />
              </div>
              <div className="flex-1 overflow-y-auto p-3.5 pt-1 space-y-3.5">
                {/* Text Overlay Tool Drawer */}
                {showTextEditor && (
                  <div className="p-3 bg-neutral-900 border border-white/15 rounded-2xl space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1">
                        <Type className="w-3.5 h-3.5 text-[#25f4ee]" /> Text Overlay
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowTextEditor(false)}
                        className="text-xs text-neutral-400 hover:text-white"
                      >
                        Done
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Type words on screen..."
                      value={overlayTextVal}
                      onChange={(e) => setOverlayTextVal(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#25f4ee]"
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {['#ffffff', '#25f4ee', '#ff2b54', '#ffd54a', '#a855f7'].map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setOverlayColor(c)}
                            style={{ backgroundColor: c }}
                            className={`w-4 h-4 rounded-full border border-black cursor-pointer transition-transform ${
                              overlayColor === c ? 'scale-125 ring-2 ring-white' : ''
                            }`}
                          />
                        ))}
                      </div>
                      <div className="flex gap-1 text-[10px]">
                        {(['top', 'center', 'bottom'] as const).map(pos => (
                          <button
                            key={pos}
                            type="button"
                            onClick={() => setOverlayPosition(pos)}
                            className={`px-2 py-0.5 rounded-lg font-bold capitalize ${
                              overlayPosition === pos ? 'bg-[#25f4ee] text-black' : 'bg-neutral-800 text-neutral-300'
                            }`}
                          >
                            {pos}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleApplyTextOverlay}
                      className="w-full py-1.5 bg-[#25f4ee] text-black font-extrabold rounded-xl text-xs"
                    >
                      Apply Text Overlay
                    </button>
                  </div>
                )}

                {/* Visual Filters Carousel */}
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 mb-1 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-[#25f4ee]" /> Aesthetic Filters
                  </label>
                  <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
                    {VIDEO_FILTERS.map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setActiveFilter(f.id)}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold shrink-0 transition-all border cursor-pointer ${
                          activeFilter === f.id
                            ? 'bg-[#25f4ee] text-black border-[#25f4ee] shadow'
                            : 'bg-neutral-900 text-neutral-300 border-white/10 hover:border-white/20'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Voiceover Recording Bar */}
                <div className="p-2.5 bg-neutral-900 border border-white/10 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                      isRecordingVoiceover ? 'bg-red-600 text-white animate-pulse' : 'bg-[#25f4ee]/20 text-[#25f4ee]'
                    }`}>
                      <Mic className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <b className="text-xs text-white block">Voiceover Commentary</b>
                      <span className="text-[10px] text-neutral-400 block">
                        {isRecordingVoiceover
                          ? `Recording audio... ${voiceoverDuration}s`
                          : voiceoverSrc
                          ? 'Voiceover attached ✅'
                          : 'Record live voice narration'}
                      </span>
                    </div>
                  </div>

                  {!isRecordingVoiceover ? (
                    <button
                      type="button"
                      onClick={startVoiceoverRecording}
                      className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-white rounded-xl border border-white/15 cursor-pointer"
                    >
                      {voiceoverSrc ? 'Re-record' : 'Record'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopVoiceoverRecording}
                      className="px-2.5 py-1 bg-red-600 text-xs font-bold text-white rounded-xl animate-pulse cursor-pointer"
                    >
                      Stop
                    </button>
                  )}
                </div>

                {/* Caption Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-neutral-300">
                      Caption / Description
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateAICaption}
                      disabled={generatingAICaption}
                      className="text-[10px] font-bold text-[#25f4ee] bg-[#25f4ee]/10 hover:bg-[#25f4ee]/20 px-2 py-0.5 rounded-full flex items-center gap-1 cursor-pointer transition-colors border border-[#25f4ee]/20 disabled:opacity-50"
                    >
                      <Sparkles className={`w-3 h-3 ${generatingAICaption ? 'animate-spin' : ''}`} />
                      {generatingAICaption ? 'Groq AI Thinking...' : 'Groq AI Caption'}
                    </button>
                  </div>
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="What's this post about? Add your thoughts..."
                    rows={2}
                    className="w-full bg-neutral-900 border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#25f4ee] transition-colors resize-none"
                  />
                </div>

                {/* Sound Title */}
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 mb-1 flex items-center gap-1">
                    <Music className="w-3.5 h-3.5 text-[#25f4ee]" /> Sound / Music Track
                  </label>
                  <input
                    type="text"
                    value={sound}
                    onChange={(e) => setSound(e.target.value)}
                    placeholder="Original sound title..."
                    className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#25f4ee]"
                  />
                </div>

                {/* Hashtags */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-neutral-300 flex items-center gap-1">
                      <Hash className="w-3.5 h-3.5 text-[#ff2b54]" /> Tags
                    </label>
                    <button
                      type="button"
                      onClick={handleSuggestAITags}
                      disabled={generatingAITags}
                      className="text-[10px] font-bold text-[#ff2b54] bg-[#ff2b54]/10 hover:bg-[#ff2b54]/20 px-2 py-0.5 rounded-full flex items-center gap-1 cursor-pointer transition-colors border border-[#ff2b54]/20 disabled:opacity-50"
                    >
                      <Sparkles className={`w-3 h-3 ${generatingAITags ? 'animate-spin' : ''}`} />
                      {generatingAITags ? 'Groq Finding...' : 'Groq AI Tags'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {POPULAR_TAGS.map((tag) => {
                      const isSelected = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleToggleTag(tag)}
                          className={`text-[11px] px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#25f4ee] text-black font-bold border-[#25f4ee]'
                              : 'bg-neutral-900 text-neutral-400 border-white/10 hover:border-white/30'
                          }`}
                        >
                          #{tag}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    type="text"
                    value={customTag}
                    onChange={(e) => setCustomTag(e.target.value)}
                    onKeyDown={handleAddCustomTag}
                    placeholder="Add custom tag and press Enter..."
                    className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#25f4ee]"
                  />
                </div>

                {/* Privacy & Audience Controls */}
                <div className="p-3 bg-neutral-900/90 border border-white/10 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-[#25f4ee]" /> Audience Visibility
                    </span>
                    <select
                      value={visibility}
                      onChange={(e: any) => setVisibility(e.target.value)}
                      className="bg-black border border-white/15 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                    >
                      <option value="public">Everyone (Public)</option>
                      <option value="friends">Friends Only</option>
                      <option value="private">Only Me (Private)</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-white/10">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-[#ff2b54]" /> Allow Comments
                    </span>
                    <input
                      type="checkbox"
                      checked={allowComments}
                      onChange={(e) => setAllowComments(e.target.checked)}
                      className="w-4 h-4 accent-[#25f4ee] cursor-pointer"
                    />
                  </div>

                  {/* Schedule Toggle */}
                  {postType === 'feed' && (
                    <div className="pt-1.5 border-t border-white/10 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-[#25f4ee]" /> Schedule Post
                        </span>
                        <input
                          type="checkbox"
                          checked={isScheduled}
                          onChange={(e) => setIsScheduled(e.target.checked)}
                          className="w-4 h-4 accent-[#25f4ee] cursor-pointer"
                        />
                      </div>

                      {isScheduled && (
                        <div className="animate-in fade-in pt-1">
                          <input
                            type="datetime-local"
                            value={scheduledDateTime}
                            onChange={(e) => setScheduledDateTime(e.target.value)}
                            className="w-full bg-black border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#25f4ee]"
                          />
                          <span className="text-[10px] text-neutral-400 block mt-0.5">
                            Post will automatically go live at chosen time.
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Upload Progress Feedback */}
                {loading && (
                  <div className="space-y-1.5 bg-neutral-900/90 border border-white/10 rounded-xl p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white font-semibold">{uploadStatusText}</span>
                      <span className="text-[#25f4ee] font-bold">{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#25f4ee] to-[#ff2b54] transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {uploadError && (
                  <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl flex items-center justify-between text-xs text-red-300">
                    <span>{uploadError}</span>
                    <button
                      onClick={handlePublish}
                      className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" /> Retry
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        {step === 'compose' && (
          <div className="p-3 border-t border-white/10 bg-[#17181c] flex gap-2 shrink-0">
            <button
              onClick={handleSaveDraft}
              disabled={loading}
              className="py-2.5 px-3 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-bold rounded-xl text-xs border border-white/10 cursor-pointer flex items-center gap-1.5"
            >
              <Bookmark className="w-3.5 h-3.5" /> Save Draft
            </button>
            <button
              id="publishPostBtn"
              onClick={handlePublish}
              disabled={loading}
              className="flex-1 py-2.5 bg-[#ff2b54] hover:bg-[#ff1a47] text-white font-extrabold rounded-xl text-xs shadow-lg transition-all active:scale-[0.99] cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" /> {postType === 'story' ? 'Share to Story' : (mediaType === 'image' || mediaType === 'carousel' ? 'Post Photo' : 'Post Video')}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
