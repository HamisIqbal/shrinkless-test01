'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createSiteUploadSignatureAction,
  publishMediaAction,
} from '@/app/actions/admin/media';
import { uploadEndpoint } from '@/lib/cloudinary/config';
import { ImageCropField } from '@/components/admin/ImageCropField';
import { LaptopIcon, PhoneIcon, TabletIcon } from '@/components/admin/icons';
import { imageUrl } from '@/lib/images';
import {
  SECTION_COLOURS,
  SECTION_COLOUR_IDS,
  isSectionColourName,
  normaliseSectionColour,
  sectionColourHex,
  sectionColourLabel,
  type SectionSetting,
} from '@/lib/media/colours';
import { ZOOM_MIN } from '@/lib/media/crop';
import type { MediaPageView, MediaSlotView } from '@/lib/services/site-media';

/** Same stamp the storefront's editor bridge uses. Anything else on the
 *  message channel is somebody else's business. */
const CHANNEL = 'shrinkless-media';

/**
 * The three widths, and what they actually are.
 *
 * Real viewport widths rather than a picture of a device: the frame is set to
 * this many CSS pixels and then scaled to fit the desk, so the storefront's
 * own media queries fire exactly as they would on the machine — a phone
 * preview is the mobile layout, not the desktop layout shrunk.
 */
const DEVICES = {
  laptop: { label: 'Laptop', width: 1280, Icon: LaptopIcon },
  tablet: { label: 'Tablet', width: 834, Icon: TabletIcon },
  mobile: { label: 'Mobile', width: 390, Icon: PhoneIcon },
} as const;

type Device = keyof typeof DEVICES;

/**
 * One photograph as the editor holds it while nothing has been published.
 *
 * One crop, not two. A change made in any device view is meant to land in all
 * of them, so the editor keeps the single placement the storefront then reads
 * at every width — see `MediaLayer`, which writes it to both custom properties.
 */
type Frame = { url: string; alt: string; focus: string; zoom: number };

/** What is being edited: a photograph, or the height of a band. */
type Selection =
  | { kind: 'media'; key: string; slotId: string; index: number }
  | { kind: 'section'; id: string };

/** The height a section is drawn at, or 0 while the design's own still stands. */
const AUTO = 0;

const HEIGHT_MAX = 1600;

/** Two settings are the same when neither half differs — an absent colour and
 *  an absent height being what a section starts as. */
function sameSetting(a: SectionSetting, b: SectionSetting): boolean {
  return (a.height ?? AUTO) === (b.height ?? AUTO) && (a.background ?? '') === (b.background ?? '');
}

/** What the storefront is serving for a section, in words — the line under the
 *  panel's title, which is the only place the admin sees the published state
 *  rather than the draft. */
function describe(setting: SectionSetting): string {
  const parts: string[] = [];

  if (setting.height) parts.push(`${setting.height}px`);
  if (setting.background) parts.push(sectionColourLabel(setting.background));

  return parts.length ? parts.join(' · ') : 'As the page sets it';
}

function toFrames(slot: MediaSlotView): Frame[] {
  return slot.frames.map((frame) => ({
    url: frame.url,
    alt: frame.alt,
    focus: frame.focus ?? '',
    zoom: frame.zoom ?? ZOOM_MIN,
  }));
}

function sameFrames(a: Frame[], b: Frame[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (frame, i) =>
        frame.url === b[i].url &&
        frame.alt === b[i].alt &&
        frame.focus === b[i].focus &&
        frame.zoom === b[i].zoom,
    )
  );
}

/** The key the storefront's layer stamps on the element showing a frame. */
function frameKey(slot: MediaSlotView, index: number): string {
  return slot.frames.length > 1 ? `${slot.slotId}#${index}` : slot.slotId;
}

/** Every slot on every page, once each — the drafts below are keyed by slot,
 *  so a frame used twice is one record and editing it from either place moves
 *  both, exactly as the storefront does. */
function allSlots(pages: MediaPageView[]): MediaSlotView[] {
  const seen = new Map<string, MediaSlotView>();

  for (const page of pages) {
    for (const slot of page.slots) {
      if (!seen.has(slot.slotId)) seen.set(slot.slotId, slot);
    }
  }

  return [...seen.values()];
}

/**
 * Sends one file to Cloudinary and returns its address.
 *
 * The bytes go straight from this browser to Cloudinary; the server only ever
 * hands out a signature, so a large photograph never travels through a
 * serverless function with a timeout on it. Resolved to a full address on the
 * way back so the preview can show it immediately — the same thing the service
 * does when it reads a public id out of the database.
 */
async function upload(file: File): Promise<string> {
  const signed = await createSiteUploadSignatureAction();
  if (!signed.ok) throw new Error(signed.error);

  const body = new FormData();
  body.set('file', file);
  body.set('api_key', signed.apiKey);
  body.set('timestamp', String(signed.timestamp));
  body.set('folder', signed.folder);
  body.set('signature', signed.signature);

  const response = await fetch(uploadEndpoint(signed.cloudName), { method: 'POST', body });
  if (!response.ok) throw new Error('Cloudinary rejected the upload.');

  const uploaded = (await response.json()) as { public_id: string };
  return imageUrl(uploaded.public_id);
}

/* --------------------------------------------------------------------------
   The panel — one photograph
   -------------------------------------------------------------------------- */

function MediaPanel({
  slot,
  frames,
  savedFrames,
  index,
  overridden,
  onChange,
  onClose,
}: {
  slot: MediaSlotView;
  frames: Frame[];
  savedFrames: Frame[];
  index: number;
  overridden: boolean;
  onChange: (frames: Frame[]) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const frame = frames[index] ?? frames[0];
  const edited = !sameFrames(frames, savedFrames);

  function patch(change: Partial<Frame>) {
    onChange(frames.map((existing, i) => (i === index ? { ...existing, ...change } : existing)));
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;

    setBusy(true);
    setError('');

    try {
      patch({ url: await upload(file) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="panel inspector mediaedit__panel" aria-label={`${slot.label} media`}>
      <header className="inspector__head">
        <div>
          <h3 className="inspector__title">
            {slot.label}
            {frames.length > 1 ? ` — frame ${index + 1} of ${frames.length}` : ''}
          </h3>
          <p className="inspector__where">{slot.where}</p>
        </div>

        <button
          type="button"
          className="abtn abtn--quiet abtn--sm inspector__close"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
      </header>

      <p className="inspector__meta">
        <span className={`mediaslot__state${overridden ? ' mediaslot__state--on' : ''}`}>
          {overridden ? 'Changed' : 'Original'}
        </span>
        {edited ? <span className="inspector__ratio">Not published</span> : null}
      </p>

      <div className="inspector__body">
        <label className="adfield">
          Image
          <input
            value={frame.url}
            onChange={(event) => patch({ url: event.target.value })}
            placeholder="https://… or a Cloudinary id"
            spellCheck={false}
          />
        </label>

        <label className="abtn abtn--ghost abtn--sm mediaslot__upload">
          {busy ? 'Uploading…' : 'Replace with a file'}
          <input
            type="file"
            accept="image/*"
            hidden
            disabled={busy}
            onChange={(event) => {
              void handleFile(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </label>

        <label className="adfield">
          Alt text
          <input
            value={frame.alt}
            onChange={(event) => patch({ alt: event.target.value })}
            maxLength={200}
            required
          />
          <small>Describe what is in the picture. Screen readers read this.</small>
        </label>

        {/* One stage rather than the desktop-and-phone pair: a crop set here
            applies at every width, which is the rule this editor publishes
            under. The shape shown is the frame's widest use. */}
        <ImageCropField
          url={frame.url}
          alt={frame.alt}
          crop={frame}
          ratios={slot.ratios}
          only="desktop"
          onChange={(crop) =>
            patch({ focus: crop.focus ?? '', zoom: crop.zoom ?? ZOOM_MIN })
          }
        />
      </div>

      <footer className="inspector__foot">
        <button
          type="button"
          className="abtn abtn--quiet abtn--sm"
          onClick={() => onChange(savedFrames)}
          disabled={!edited}
        >
          Reset this photograph
        </button>

        {error ? <p className="anotice anotice--error">{error}</p> : null}
      </footer>
    </aside>
  );
}

/* --------------------------------------------------------------------------
   The panel — one section's height
   -------------------------------------------------------------------------- */

function SectionPanel({
  label,
  setting,
  savedSetting,
  onChange,
  onClose,
}: {
  label: string;
  setting: SectionSetting;
  savedSetting: SectionSetting;
  onChange: (setting: SectionSetting) => void;
  onClose: () => void;
}) {
  const height = setting.height ?? AUTO;
  const background = setting.background;
  const edited = !sameSetting(setting, savedSetting);
  const set = savedSetting.height || savedSetting.background;

  /* The colour of its own this section is set to, if it is set to one at all —
     a named ground is not a custom colour, and neither is nothing. */
  const custom = isSectionColourName(background) ? '' : normaliseSectionColour(background);

  /* The hex box shows what is being typed rather than what is stored, so a
     half-written `#ab` is not thrown away on the way to becoming `#abcdef`.
     Every other way of setting the colour drops what was typed and the box
     goes back to showing the setting. */
  const [typed, setTyped] = useState<string | null>(null);
  const hex = typed ?? custom;

  function patch(change: SectionSetting) {
    onChange({ ...setting, ...change });
  }

  /** A colour chosen rather than typed — a swatch, the wheel, or the way back
   *  to the page's own. */
  function choose(background: SectionSetting['background']) {
    setTyped(null);
    patch({ background });
  }

  /** The whole section put back, to what was published or to the design's
   *  own. */
  function restore(next: SectionSetting) {
    setTyped(null);
    onChange(next);
  }

  /* The wheel needs a colour to open on even when the section has none: the
     ground it is standing on now, so the picker starts where the eye is. */
  const wheel = custom || sectionColourHex(background) || SECTION_COLOURS.paper.hex;

  return (
    <aside className="panel inspector mediaedit__panel" aria-label={`${label} section`}>
      <header className="inspector__head">
        <div>
          <h3 className="inspector__title">{label}</h3>
          <p className="inspector__where">
            The ground this band stands on, and how tall it is. Both apply at every width.
          </p>
        </div>

        <button
          type="button"
          className="abtn abtn--quiet abtn--sm inspector__close"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
      </header>

      <p className="inspector__meta">
        <span className={`mediaslot__state${set ? ' mediaslot__state--on' : ''}`}>
          {describe(savedSetting)}
        </span>
        {edited ? <span className="inspector__ratio">Not published</span> : null}
      </p>

      <div className="inspector__body">
        {/* The site's own three first, because a band that matches one of
            them is the usual answer, and then the whole spectrum for the ones
            that are dressed for a season. Named grounds are stored by name and
            follow a re-tint; a colour picked here is stored as it stands. */}
        <fieldset className="adfield mediaedit__colours">
          <legend>Colour</legend>

          <div className="swatches" role="radiogroup" aria-label="Section colour">
            <button
              type="button"
              role="radio"
              aria-checked={!background}
              className={`swatch swatch--none${!background ? ' swatch--on' : ''}`}
              onClick={() => choose(undefined)}
              title="As the page sets it"
            >
              <span className="swatch__chip" aria-hidden="true" />
              <span className="swatch__name">Page&rsquo;s own</span>
            </button>

            {SECTION_COLOUR_IDS.map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={background === id}
                className={`swatch${background === id ? ' swatch--on' : ''}`}
                onClick={() => choose(id)}
                title={SECTION_COLOURS[id].hex}
              >
                <span
                  className="swatch__chip"
                  style={{ background: SECTION_COLOURS[id].hex }}
                  aria-hidden="true"
                />
                <span className="swatch__name">{SECTION_COLOURS[id].label}</span>
              </button>
            ))}
          </div>

          {/* The wheel and the hex are the same setting twice: one for picking
              a colour by eye, one for a value carried in from a brand sheet. */}
          <div className={`swatch swatch--any${custom ? ' swatch--on' : ''}`}>
            <input
              type="color"
              className="swatch__wheel"
              value={wheel}
              onChange={(event) => choose(normaliseSectionColour(event.target.value))}
              aria-label="Any colour"
            />

            <input
              type="text"
              className="swatch__hex"
              value={hex}
              placeholder="#000000"
              spellCheck={false}
              maxLength={7}
              onChange={(event) => {
                const next = event.target.value;
                setTyped(next);

                const colour = normaliseSectionColour(next);
                if (colour) patch({ background: colour });
                else if (custom && !next.trim()) patch({ background: undefined });
              }}
              aria-label="Colour as hex"
            />
          </div>

          <small>
            The first three are the grounds the rest of the site is built on, and move with it if
            the brand is ever re-tinted. Any other colour is kept exactly as picked — the type on
            this band is dark, so leave it something dark ink can be read against.
          </small>
        </fieldset>

        <label className="adfield">
          Height
          <div className="mediaedit__height">
            <input
              type="range"
              min={0}
              max={HEIGHT_MAX}
              step={10}
              value={height}
              onChange={(event) => patch({ height: Number(event.target.value) })}
              aria-label="Height"
            />
            <input
              type="number"
              min={0}
              max={HEIGHT_MAX}
              step={10}
              value={height}
              onChange={(event) =>
                patch({
                  height: Math.max(0, Math.min(HEIGHT_MAX, Number(event.target.value) || 0)),
                })
              }
              aria-label="Height in pixels"
            />
            <span className="mediaedit__unit">px</span>
          </div>
          <small>
            Zero gives the section back the height the page gives it. The preview follows every
            change; nothing reaches the shop until Publish.
          </small>
        </label>
      </div>

      <footer className="inspector__foot">
        <button
          type="button"
          className="abtn abtn--quiet abtn--sm"
          onClick={() => restore(savedSetting)}
          disabled={!edited}
        >
          Reset this section
        </button>

        <button
          type="button"
          className="abtn abtn--quiet abtn--sm"
          onClick={() => restore({})}
          disabled={!height && !background}
        >
          Back to the page&rsquo;s own
        </button>
      </footer>
    </aside>
  );
}

/* --------------------------------------------------------------------------
   The editor
   -------------------------------------------------------------------------- */

function Editor({ pages, onPublished }: { pages: MediaPageView[]; onPublished: () => void }) {
  const router = useRouter();

  const slots = useMemo(() => allSlots(pages), [pages]);
  const byId = useMemo(() => new Map(slots.map((slot) => [slot.slotId, slot])), [slots]);

  /* What the storefront is serving right now — the last publish, or the frame
     the site shipped with if there has never been one. Everything the admin
     does lives in the drafts until Publish. */
  const saved = useMemo<Record<string, Frame[]>>(
    () => Object.fromEntries(slots.map((slot) => [slot.slotId, toFrames(slot)])),
    [slots],
  );

  const savedSections = useMemo<Record<string, SectionSetting>>(
    () =>
      Object.fromEntries(
        pages.flatMap((page) =>
          page.sections.map((section) => [
            section.id,
            {
              ...(section.height ? { height: section.height } : {}),
              ...(section.background ? { background: section.background } : {}),
            },
          ]),
        ),
      ),
    [pages],
  );

  const [drafts, setDrafts] = useState<Record<string, Frame[]>>(saved);
  const [settings, setSettings] = useState<Record<string, SectionSetting>>(savedSections);
  const [overridden, setOverridden] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(slots.map((slot) => [slot.slotId, slot.overridden])),
  );

  const [pageId, setPageId] = useState(pages[0]?.id ?? '');
  const [device, setDevice] = useState<Device>('laptop');
  const [selection, setSelection] = useState<Selection | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const frame = useRef<HTMLIFrameElement | null>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });

  const page = pages.find((candidate) => candidate.id === pageId) ?? pages[0];

  /* Which slot and which frame of it every key on this page belongs to, so a
     selection coming back from the storefront resolves without the page
     having to send anything but the key it stamped. */
  const keys = useMemo(() => {
    const map = new Map<string, { slotId: string; index: number }>();

    for (const slot of page?.slots ?? []) {
      slot.frames.forEach((_, index) => map.set(frameKey(slot, index), { slotId: slot.slotId, index }));
    }

    return map;
  }, [page]);

  const dirtySlots = (page?.slots ?? []).filter(
    (slot) => !sameFrames(drafts[slot.slotId] ?? [], saved[slot.slotId] ?? []),
  );

  const dirtySections = (page?.sections ?? []).filter(
    (section) => !sameSetting(settings[section.id] ?? {}, savedSections[section.id] ?? {}),
  );

  const dirty = dirtySlots.length + dirtySections.length;

  /* The stage measures itself so the frame can be a real viewport scaled to
     fit rather than a viewport the desk happens to have room for. */
  useEffect(() => {
    const node = stage.current;
    if (!node) return;

    const measure = () => {
      const rect = node.getBoundingClientRect();
      setBox({ width: rect.width, height: rect.height });
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  /** Hands the frame everything it needs to draw itself as it would be if
   *  Publish were pressed. Sent on every change, and sent to the page — never
   *  to the database. */
  const push = useCallback(() => {
    const window_ = frame.current?.contentWindow;
    if (!window_) return;

    const media: Record<string, Frame> = {};

    for (const slot of page?.slots ?? []) {
      (drafts[slot.slotId] ?? []).forEach((draft, index) => {
        media[frameKey(slot, index)] = draft;
      });
    }

    const sections: Record<string, SectionSetting> = {};
    for (const section of page?.sections ?? []) sections[section.id] = settings[section.id] ?? {};

    window_.postMessage({ channel: CHANNEL, type: 'apply', media, sections }, location.origin);
  }, [drafts, settings, page]);

  useEffect(() => {
    push();
  }, [push]);

  useEffect(() => {
    const id = selection
      ? selection.kind === 'media'
        ? `media:${selection.key}`
        : `section:${selection.id}`
      : null;

    frame.current?.contentWindow?.postMessage(
      { channel: CHANNEL, type: 'select', id },
      location.origin,
    );
  }, [selection]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;

      const data = event.data as { channel?: string; type?: string; id?: string };
      if (data?.channel !== CHANNEL) return;

      if (data.type === 'ready') {
        push();
        return;
      }

      if (data.type !== 'select' || !data.id) return;

      if (data.id.startsWith('section:')) {
        setSelection({ kind: 'section', id: data.id.slice('section:'.length) });
        return;
      }

      const key = data.id.slice('media:'.length);
      const found = keys.get(key);
      if (found) setSelection({ kind: 'media', key, ...found });
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [keys, push]);

  /* The editor is the whole screen while it is open, so the page behind it
     must not scroll under it. */
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  function choosePage(next: string) {
    setPageId(next);
    setSelection(null);
    setMessage('');
  }

  /** Everything changed on this page, in one write. Nothing before now has
   *  touched the storefront. */
  function publish() {
    setError('');
    setMessage('');

    const payload = {
      slots: dirtySlots.map((slot) => ({
        slotId: slot.slotId,
        // The phone's crop is deliberately cleared rather than carried: one
        // placement is the rule here, so a slot published from this editor
        // reads the same at every width.
        frames: (drafts[slot.slotId] ?? []).map((draft) => ({
          url: draft.url,
          alt: draft.alt,
          focus: draft.focus,
          zoom: draft.zoom,
          mobileFocus: '',
        })),
      })),
      sections: dirtySections.map((section) => ({
        sectionId: section.id,
        height: settings[section.id]?.height ?? AUTO,
        background: settings[section.id]?.background ?? '',
      })),
    };

    startTransition(async () => {
      const result = await publishMediaAction(payload);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setOverridden((current) => {
        const next = { ...current };
        for (const slot of payload.slots) next[slot.slotId] = true;
        return next;
      });

      setMessage('Published. The storefront is serving this now.');
      onPublished();
    });
  }

  const width = DEVICES[device].width;
  const pad = 24;
  const scale = box.width ? Math.min(1, (box.width - pad * 2) / width) : 1;
  const height = box.height ? Math.max(320, (box.height - pad * 2) / scale) : 0;

  const slot = selection?.kind === 'media' ? byId.get(selection.slotId) : undefined;
  const section =
    selection?.kind === 'section'
      ? page?.sections.find((candidate) => candidate.id === selection.id)
      : undefined;

  return (
    <div className="mediaedit">
      <header className="mediaedit__bar">
        <button
          type="button"
          className="abtn abtn--quiet abtn--sm mediaedit__close"
          onClick={() => router.push('/admin')}
        >
          ✕ Close
        </button>

        <div className="mediaedit__mid">
          <label className="adfield adfield--inline mediaedit__page">
            Page
            <select value={page?.id ?? ''} onChange={(event) => choosePage(event.target.value)}>
              {pages.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.label}
                </option>
              ))}
            </select>
          </label>

          <div className="viewtoggle mediaedit__devices" role="group" aria-label="Preview width">
            {(Object.keys(DEVICES) as Device[]).map((value) => {
              const { label, Icon } = DEVICES[value];

              return (
                <button
                  key={value}
                  type="button"
                  className={`viewtoggle__btn${device === value ? ' viewtoggle__btn--on' : ''}`}
                  onClick={() => setDevice(value)}
                  aria-pressed={device === value}
                  aria-label={`${label} — ${DEVICES[value].width}px wide`}
                  title={`${label} — ${DEVICES[value].width}px`}
                >
                  <Icon className="mediaedit__icon" />
                  <span className="mediaedit__devicename">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mediaedit__acts">
          {error ? <p className="anotice anotice--error mediaedit__note">{error}</p> : null}
          {!error && message ? <p className="anotice mediaedit__note">{message}</p> : null}

          <button type="button" className="abtn abtn--sm" onClick={publish} disabled={pending || !dirty}>
            {pending ? 'Publishing…' : `Publish${dirty ? ` (${dirty})` : ''}`}
          </button>
        </div>
      </header>

      <div className={`mediaedit__body${selection ? ' mediaedit__body--open' : ''}`}>
        <div className="mediaedit__stage" ref={stage}>
          <div
            className="mediaedit__viewport"
            style={{ width: width * scale, height: box.height ? box.height - pad * 2 : undefined }}
          >
            {page ? (
              <iframe
                key={page.id}
                ref={frame}
                className="mediaedit__frame"
                src={`${page.path}${page.path.includes('?') ? '&' : '?'}mdedit=1`}
                title="The page as visitors see it"
                style={{
                  width,
                  height: height || undefined,
                  transform: `scale(${scale})`,
                  transformOrigin: '0 0',
                }}
              />
            ) : null}
          </div>

          <p className="mediaedit__hint">
            Click a photograph to replace or re-crop it, or anywhere else in a band to set its
            colour and height. Every change applies at all three widths.
          </p>
        </div>

        {slot && selection?.kind === 'media' ? (
          <MediaPanel
            key={selection.key}
            slot={slot}
            frames={drafts[slot.slotId] ?? []}
            savedFrames={saved[slot.slotId] ?? []}
            index={Math.min(selection.index, (drafts[slot.slotId] ?? []).length - 1)}
            overridden={overridden[slot.slotId] ?? false}
            onChange={(frames) => {
              setMessage('');
              setDrafts((current) => ({ ...current, [slot.slotId]: frames }));
            }}
            onClose={() => setSelection(null)}
          />
        ) : null}

        {section && selection?.kind === 'section' ? (
          <SectionPanel
            key={section.id}
            label={section.label}
            setting={settings[section.id] ?? {}}
            savedSetting={savedSections[section.id] ?? {}}
            onChange={(next) => {
              setMessage('');
              setSettings((current) => ({ ...current, [section.id]: next }));
            }}
            onClose={() => setSelection(null)}
          />
        ) : null}
      </div>
    </div>
  );
}

/**
 * The storefront, edited in place.
 *
 * Not a rehearsal of the page and not a set of forms: the stage is the page
 * itself, in a frame, rendered by the same components and the same stylesheets
 * a visitor gets. The editor talks to it over `postMessage` — the page reports
 * what was clicked, and the editor sends back the drafts it is holding, so a
 * replaced photograph or a taller band is on screen the moment it changes and
 * nowhere else until Publish.
 *
 * A publish changes what the server would send, so the editor refreshes and
 * remounts: the drafts start again from what came back, and the admin is left
 * exactly where they were.
 */
export function MediaManager({ pages }: { pages: MediaPageView[] }) {
  const router = useRouter();
  const [version, setVersion] = useState(0);

  return (
    <Editor
      key={version}
      pages={pages}
      onPublished={() => {
        router.refresh();
        setVersion((current) => current + 1);
      }}
    />
  );
}
