import type { SiteMedia } from '@/services/contentAdmin';

export default function JournalMediaFields({ media, onChange, onUpload }: {
  media: SiteMedia;
  onChange: (media: SiteMedia) => void;
  onUpload: (file: File | undefined, cover: boolean) => void;
}) {
  const photo = media.type === 'photo';
  return (
    <>
      <label>Назва
        <input required minLength={2} maxLength={200} value={media.title} onChange={e => onChange({ ...media, title: e.target.value })} />
      </label>
      <label>Тип
        <select value={media.type} onChange={e => onChange({ ...media, type: e.target.value === 'video' ? 'video' : 'photo', url: '', cover: '' })}>
          <option value="photo">Фото</option>
          <option value="video">Відео</option>
        </select>
      </label>
      <label>HTTPS-посилання на файл або відео
        <input type="url" required value={media.url} onChange={e => onChange({ ...media, url: e.target.value })} />
      </label>
      <label>{photo ? 'Завантажити фото (до 5 МБ)' : 'Завантажити MP4 / WebM (до 25 МБ)'}
        <input type="file" accept={photo ? 'image/jpeg,image/png,image/webp' : 'video/mp4,video/webm'} onChange={e => { onUpload(e.target.files?.[0], false); e.target.value = ''; }} />
      </label>
      <label>Обкладинка (HTTPS-посилання)
        <input type="url" value={media.cover} onChange={e => onChange({ ...media, cover: e.target.value })} />
      </label>
      <label>Завантажити обкладинку
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { onUpload(e.target.files?.[0], true); e.target.value = ''; }} />
      </label>
      <label>Порядок показу
        <input type="number" min={0} max={10000} step={1} value={media.sortOrder} onChange={e => onChange({ ...media, sortOrder: Number(e.target.value) })} />
      </label>
    </>
  );
}
