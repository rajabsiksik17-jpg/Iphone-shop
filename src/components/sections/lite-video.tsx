"use client";

import { useState } from "react";
import { Play } from "lucide-react";

/** Privacy-friendly video: nothing loads from YouTube/Vimeo until the user presses play. */
export function LiteVideo({ url, title, poster }: { url: string; title: string; poster?: string | null }) {
  const [play, setPlay] = useState(false);
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  const src = yt ? `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1&rel=0` : vimeo ? `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1` : null;
  if (!src) return null;
  return (
    <div className="relative aspect-video overflow-hidden rounded-card bg-neutral-900">
      {play ? (
        <iframe src={src} title={title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="absolute inset-0 size-full" loading="lazy" />
      ) : (
        <button type="button" onClick={() => setPlay(true)} className="group absolute inset-0 grid place-items-center" aria-label={`Play: ${title}`}>
          {(poster || yt) && <img src={poster || `https://i.ytimg.com/vi/${yt![1]}/hqdefault.jpg`} alt="" className="absolute inset-0 size-full object-cover opacity-80 transition group-hover:opacity-100" loading="lazy" />}
          <span className="relative grid size-20 place-items-center rounded-full bg-white/90 text-neutral-900 shadow-2xl transition group-hover:scale-110">
            <Play className="ms-1 size-8 fill-current" />
          </span>
        </button>
      )}
    </div>
  );
}
