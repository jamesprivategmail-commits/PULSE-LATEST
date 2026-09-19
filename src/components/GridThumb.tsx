import React from 'react';
import { VideoPost } from '../types';

interface GridThumbProps {
  video: VideoPost;
  className?: string;
}

// Renders a single grid tile for a post/video, used across profile grids
// (UserProfilePage, OtherProfilePage). Fixes "blank posts" bug:
// - image/carousel posts were being rendered with a <video> tag pointed at
//   an image URL, which a browser cannot decode and renders as nothing.
// - video posts had no `poster` and no `preload`, so most mobile browsers
//   show a blank/black frame until the clip is actually played.
export const GridThumb: React.FC<GridThumbProps> = ({ video, className = '' }) => {
  const isImage = video.mediaType === 'image' || video.mediaType === 'carousel';
  const thumbSrc = video.coverUrl || (isImage ? (video.images?.[0] || video.src) : undefined);

  if (isImage) {
    return (
      <img
        src={video.images?.[0] || video.coverUrl || video.src}
        alt=""
        className={`w-full h-full object-cover ${className}`}
      />
    );
  }

  return (
    <video
      src={video.src}
      poster={thumbSrc}
      className={`w-full h-full object-cover ${className}`}
      preload="metadata"
      muted
      playsInline
    />
  );
};
