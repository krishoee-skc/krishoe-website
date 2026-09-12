"use client";

import Image from "next/image";
import { useState } from "react";
import T from "@/components/T";

/**
 * A YouTube video, without YouTube's weight until someone asks for it.
 *
 * An embedded iframe loads roughly a megabyte of player before anyone presses
 * play, and it sets Google's advertising cookies on arrival whether or not the
 * video is watched. On a shop whose customers are mostly on phone data in
 * Nepal, both are worth avoiding for something most visitors will scroll past.
 *
 * So what renders first is the thumbnail YouTube already hosts, with a real
 * play button over it. The iframe is created on the first click, and only then,
 * with `youtube-nocookie.com` so a visitor who never plays it is never tracked
 * by it. `autoplay=1` on that first load means the click that swaps the image
 * for the player is also the click that starts it — one press, not two.
 *
 * The component takes an id, not a URL, because the id is the one part of a
 * YouTube address that does not change. A share link carries tracking
 * parameters, a channel link is not a video at all, and both break silently
 * when pasted where an id is expected.
 */
export default function ShopVideo({
  id,
  title,
  titleNe,
}: {
  /** The eleven-character id from the video's address, not the whole URL. */
  id: string;
  title: string;
  titleNe: string;
}) {
  const [playing, setPlaying] = useState(false);

  if (!id.trim()) return null;

  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl bg-brand-green-ink shadow-lg ring-1 ring-brand-gold/25">
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group absolute inset-0 h-full w-full cursor-pointer"
        >
          {/* YouTube serves this itself, so it costs one image rather than a
              player. hqdefault exists for every video; maxresdefault does not. */}
          <Image
            src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
            alt=""
            fill
            sizes="(min-width: 768px) 768px, 100vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
          <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-gold text-brand-green-ink shadow-xl transition group-hover:scale-110">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="ml-1 h-7 w-7">
                <path d="M8 5v14l11-7L8 5Z" />
              </svg>
            </span>
          </span>
          <span className="absolute inset-x-0 bottom-0 p-4 text-left text-sm font-bold text-white md:text-base">
            <T en={title} ne={titleNe} />
          </span>
        </button>
      )}
    </div>
  );
}
