import React, { useState } from 'react';
import { VideoPost } from '../types';
import { 
  X, 
  Copy, 
  Check, 
  Send, 
  Share2, 
  QrCode, 
  Code, 
  MessageSquare, 
  Download,
  Sparkles
} from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  video: VideoPost;
  onClose: () => void;
  onToast: (msg: string) => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  video,
  onClose,
  onToast
}) => {
  const [copied, setCopied] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);

  if (!isOpen) return null;

  const videoUrl = `${window.location.origin}/?v=${video.id}`;
  const encodedUrl = encodeURIComponent(videoUrl);
  const shareText = encodeURIComponent(`Watch ${video.ownerHandle}'s video on Pulse: "${video.caption.slice(0, 60)}..." 🔥`);

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(videoUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = videoUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      onToast('Link copied to clipboard! 📋');
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      setCopied(true);
      onToast('Link copied! 📋');
    }
  };

  const handleShareWhatsApp = () => {
    window.open(`https://api.whatsapp.com/send?text=${shareText}%20${encodedUrl}`, '_blank');
  };

  const handleShareTwitter = () => {
    window.open(`https://twitter.com/intent/tweet?text=${shareText}&url=${encodedUrl}&hashtags=pulse,viral`, '_blank');
  };

  const handleShareTelegram = () => {
    window.open(`https://t.me/share/url?url=${encodedUrl}&text=${shareText}`, '_blank');
  };

  const handleShareFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank');
  };

  const embedCode = `<iframe src="${videoUrl}" width="340" height="600" frameborder="0" allowfullscreen></iframe>`;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in select-none">
      <div className="w-full max-w-sm bg-black border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/10 bg-neutral-950">
          <div className="flex items-center gap-1.5">
            <Share2 className="w-3.5 h-3.5 text-[#25f4ee]" />
            <span className="font-bold text-white text-xs">Share Video</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3 space-y-3 bg-black">
          {/* Quick Social Shares Grid */}
          <div>
            <span className="text-[9.5px] font-bold text-neutral-400 uppercase tracking-wider block mb-1.5">
              Share &amp; Save
            </span>
            <div className="grid grid-cols-5 gap-1">
              <button
                onClick={handleShareWhatsApp}
                className="flex flex-col items-center gap-1 p-1 rounded-lg bg-neutral-950 border border-white/10 hover:border-[#25D366]/50 hover:bg-[#25D366]/10 transition-all cursor-pointer group"
              >
                <div className="w-6 h-6 rounded-md bg-[#25D366]/20 text-[#25D366] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <MessageSquare className="w-3 h-3" />
                </div>
                <span className="text-[8.5px] font-semibold text-neutral-300">WhatsApp</span>
              </button>

              <button
                onClick={handleShareTelegram}
                className="flex flex-col items-center gap-1 p-1 rounded-lg bg-neutral-950 border border-white/10 hover:border-[#0088cc]/50 hover:bg-[#0088cc]/10 transition-all cursor-pointer group"
              >
                <div className="w-6 h-6 rounded-md bg-[#0088cc]/20 text-[#0088cc] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Send className="w-3 h-3" />
                </div>
                <span className="text-[8.5px] font-semibold text-neutral-300">Telegram</span>
              </button>

              <button
                onClick={handleShareTwitter}
                className="flex flex-col items-center gap-1 p-1 rounded-lg bg-neutral-950 border border-white/10 hover:border-[#1DA1F2]/50 hover:bg-[#1DA1F2]/10 transition-all cursor-pointer group"
              >
                <div className="w-6 h-6 rounded-md bg-[#1DA1F2]/20 text-[#1DA1F2] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </div>
                <span className="text-[8.5px] font-semibold text-neutral-300">X / Tweet</span>
              </button>

              {/* Download / Save Video */}
              <button
                onClick={async () => {
                  try {
                    onToast('Downloading video... 📥');
                    const res = await fetch(video.src);
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `pulse_video_${video.id}.mp4`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    onToast('Video saved to device! ✅');
                  } catch (err) {
                    const a = document.createElement('a');
                    a.href = video.src;
                    a.target = '_blank';
                    a.download = `pulse_video_${video.id}.mp4`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    onToast('Download started 📥');
                  }
                }}
                className="flex flex-col items-center gap-1 p-1 rounded-lg bg-neutral-950 border border-white/10 hover:border-[#ffd54a]/50 hover:bg-[#ffd54a]/10 transition-all cursor-pointer group"
              >
                <div className="w-6 h-6 rounded-md bg-[#ffd54a]/20 text-[#ffd54a] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Download className="w-3 h-3" />
                </div>
                <span className="text-[8.5px] font-semibold text-neutral-300">Download</span>
              </button>

              <button
                onClick={() => setShowQrCode(!showQrCode)}
                className={`flex flex-col items-center gap-1 p-1 rounded-lg border transition-all cursor-pointer group ${
                  showQrCode
                    ? 'bg-[#25f4ee]/20 border-[#25f4ee]'
                    : 'bg-neutral-950 border-white/10 hover:border-[#25f4ee]/50'
                }`}
              >
                <div className="w-6 h-6 rounded-md bg-[#25f4ee]/20 text-[#25f4ee] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <QrCode className="w-3 h-3" />
                </div>
                <span className="text-[8.5px] font-semibold text-neutral-300">QR Code</span>
              </button>
            </div>
          </div>

          {/* QR Code Viewer */}
          {showQrCode && (
            <div className="p-2.5 bg-neutral-950 border border-white/10 rounded-lg flex flex-col items-center text-center animate-in fade-in">
              <div className="w-32 h-32 bg-white p-1.5 rounded-lg flex items-center justify-center shadow-lg mb-1">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodedUrl}&color=000000&bgcolor=FFFFFF`}
                  alt="Video QR Code"
                  className="w-full h-full object-contain"
                />
              </div>
              <p className="text-[10px] text-neutral-300 font-semibold">Scan with phone camera to watch</p>
            </div>
          )}

          {/* Copy Link Field */}
          <div>
            <span className="text-[9.5px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
              Video URL
            </span>
            <div className="flex items-center gap-1.5 bg-neutral-950 border border-white/10 rounded-lg p-1 pl-2">
              <span className="text-[10px] text-neutral-300 truncate flex-1 font-mono">
                {videoUrl}
              </span>
              <button
                onClick={handleCopyLink}
                className={`px-2.5 py-1 rounded-md font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
                  copied
                    ? 'bg-emerald-500 text-black'
                    : 'bg-[#25f4ee] text-black hover:bg-[#20ded8]'
                }`}
              >
                {copied ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Embed Code Toggle */}
          <div>
            <button
              onClick={() => setShowEmbed(!showEmbed)}
              className="text-[10px] text-[#25f4ee] font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Code className="w-2.5 h-2.5" /> {showEmbed ? 'Hide Embed Code' : 'Get Embed Code'}
            </button>
            {showEmbed && (
              <div className="mt-1 bg-neutral-950 border border-white/10 rounded-lg p-2">
                <p className="text-[9px] text-neutral-400 mb-1 font-mono break-all">{embedCode}</p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(embedCode);
                    onToast('Embed code copied! 💻');
                  }}
                  className="text-[10px] font-bold text-white bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded-md cursor-pointer mt-0.5"
                >
                  Copy Embed Code
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
