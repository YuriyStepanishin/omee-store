import type { MediaItem } from '@/types/store';
import css from './MediaPreview.module.css';

function instagramPost(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !['www.instagram.com', 'instagram.com'].includes(url.host)) return;
    const post = /^\/(?:[\w.]+\/)?(p|reel)\/([\w-]+)\/?$/.exec(url.pathname);
    if (!post) return;
    const [, kind, code] = post;
    return { kind, url: `https://www.instagram.com/${kind}/${code}/` };
  } catch {
    return;
  }
}

export default function MediaPreview({ item, className }: { item: MediaItem; className?: string }) {
  const instagram = instagramPost(item.url);
  if (instagram) {
    return (
      <div className={css.instagram}>
        <iframe
          className={css.frame}
          data-kind={instagram.kind}
          src={instagram.url + 'embed/'}
          title={item.title}
          loading="lazy"
          allow="fullscreen; encrypted-media"
          referrerPolicy="strict-origin-when-cross-origin"
        />
        <a className={css.source} href={instagram.url} target="_blank" rel="noopener noreferrer">
          Відкрити в Instagram ↗
        </a>
      </div>
    );
  }
  if (item.type === 'photo') {
    return <img className={className} src={item.cover || item.url} alt={item.title} loading="lazy" />;
  }
  let id = '';
  try {
    const url = new URL(item.url);
    if (['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com'].includes(url.hostname)) {
      id = url.searchParams.get('v') || url.pathname.split('/embed/')[1] || '';
    }
    if (url.hostname === 'youtu.be') id = url.pathname.slice(1);
  } catch {}
  if (/^[a-zA-Z0-9_-]{11}$/.test(id)) {
    return <iframe className={className} src={'https://www.youtube-nocookie.com/embed/' + id}
      title={item.title} loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />;
  }
  return <video className={className} controls preload="metadata" src={item.url}
    poster={item.cover || undefined} aria-label={item.title} />;
}
