'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { publishMediaAction } from '@/app/actions/admin/media';
import { MediaSlotRow, sameFrames, type Frame } from '@/components/admin/MediaSlotRow';
import { AUTO, SectionRow, sameSetting } from '@/components/admin/SectionRow';
import type { SectionSetting } from '@/lib/media/colours';
import { ZOOM_MIN } from '@/lib/media/crop';
import type { MediaPageView, MediaSlotView } from '@/lib/services/site-media';

/**
 * Which row is open, as `slot:home:editorial:torso` or `section:hero`.
 *
 * One at a time: two crop stages are already a lot to have on screen, and four
 * is a scroll rather than a comparison. Scoped by page as well as by slot, so
 * a photograph listed under both pages opens where it was clicked rather than
 * in two places at once — they are still the one record underneath.
 */
type OpenKey = string;

function toFrames(slot: MediaSlotView): Frame[] {
  return slot.frames.map((frame) => ({
    url: frame.url,
    alt: frame.alt,
    focus: frame.focus ?? '',
    zoom: frame.zoom ?? ZOOM_MIN,
    mobileFocus: frame.mobileFocus ?? '',
    mobileZoom: frame.mobileZoom,
  }));
}

/**
 * Every slot on every page, once each.
 *
 * The drafts below are keyed by slot, so a photograph standing on two pages is
 * one record and editing it from either place moves both — exactly what the
 * storefront does with it.
 */
function allSlots(pages: MediaPageView[]): MediaSlotView[] {
  const seen = new Map<string, MediaSlotView>();

  for (const page of pages) {
    for (const slot of page.slots) {
      if (!seen.has(slot.slotId)) seen.set(slot.slotId, slot);
    }
  }

  return [...seen.values()];
}

/* --------------------------------------------------------------------------
   The editor
   -------------------------------------------------------------------------- */

function Editor({ pages, onPublished }: { pages: MediaPageView[]; onPublished: () => void }) {
  const slots = useMemo(() => allSlots(pages), [pages]);

  /* What the storefront is serving right now — the last publish, or the frame
     the site shipped with if there has never been one. Everything the admin
     does lives in the drafts until Publish. */
  const saved = useMemo<Record<string, Frame[]>>(
    () => Object.fromEntries(slots.map((slot) => [slot.slotId, toFrames(slot)])),
    [slots],
  );

  const sections = useMemo(
    () => pages.find((page) => page.sections.length)?.sections ?? [],
    [pages],
  );

  const savedSections = useMemo<Record<string, SectionSetting>>(
    () =>
      Object.fromEntries(
        sections.map((section) => [
          section.id,
          {
            ...(section.height ? { height: section.height } : {}),
            ...(section.background ? { background: section.background } : {}),
          },
        ]),
      ),
    [sections],
  );

  const [drafts, setDrafts] = useState<Record<string, Frame[]>>(saved);
  const [settings, setSettings] = useState<Record<string, SectionSetting>>(savedSections);
  const [overridden, setOverridden] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(slots.map((slot) => [slot.slotId, slot.overridden])),
  );

  const [open, setOpen] = useState<OpenKey>('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const dirtySlots = slots.filter(
    (slot) => !sameFrames(drafts[slot.slotId] ?? [], saved[slot.slotId] ?? []),
  );

  const dirtySections = sections.filter(
    (section) => !sameSetting(settings[section.id] ?? {}, savedSections[section.id] ?? {}),
  );

  const dirty = dirtySlots.length + dirtySections.length;

  function toggle(key: OpenKey) {
    setOpen((current) => (current === key ? '' : key));
  }

  /** Everything changed anywhere in the list, in one write. Nothing before now
   *  has touched the storefront. */
  function publish() {
    setError('');
    setMessage('');

    const payload = {
      slots: dirtySlots.map((slot) => ({
        slotId: slot.slotId,
        frames: (drafts[slot.slotId] ?? []).map((draft) => ({
          url: draft.url,
          alt: draft.alt,
          focus: draft.focus,
          zoom: draft.zoom,
          /* The phone's placement travels with the desk's. It is absent rather
             than 1 until somebody has actually dragged that stage, which is
             what `mobileView` reads as "follow the desktop". */
          mobileFocus: draft.mobileFocus,
          ...(draft.mobileZoom === undefined ? {} : { mobileZoom: draft.mobileZoom }),
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

  return (
    <div className="medialist">
      <div className="medialist__bar">
        <p className="medialist__count">
          {dirty
            ? `${dirty} unpublished change${dirty === 1 ? '' : 's'}`
            : 'Everything here is live.'}
        </p>

        <div className="medialist__acts">
          {error ? <p className="anotice anotice--error medialist__note">{error}</p> : null}
          {!error && message ? <p className="anotice medialist__note">{message}</p> : null}

          <button
            type="button"
            className="abtn abtn--sm"
            onClick={publish}
            disabled={pending || !dirty}
          >
            {pending ? 'Publishing…' : `Publish${dirty ? ` (${dirty})` : ''}`}
          </button>

          <button
            type="button"
            className="abtn abtn--quiet abtn--sm"
            onClick={() => {
              setError('');
              setMessage('');
              setDrafts(saved);
              setSettings(savedSections);
            }}
            disabled={pending || !dirty}
          >
            Discard
          </button>
        </div>
      </div>

      {pages.map((page) => (
        <section key={page.id} className="panel mediagroup">
          <header className="mediagroup__head">
            <h2 className="mediagroup__title">{page.label}</h2>
            <p className="mediagroup__note">
              {page.slots.length} image{page.slots.length === 1 ? '' : 's'}, in the order the page
              runs them.
            </p>
          </header>

          <ul className="mediagroup__list">
            {page.slots.map((slot) => (
              <MediaSlotRow
                /* Keyed by page as well as slot: a frame standing on both
                   pages is listed twice on purpose, and the two rows open
                   independently even though they edit the one record. */
                key={`${page.id}:${slot.slotId}`}
                label={slot.label}
                where={slot.where}
                ratios={slot.ratios}
                frames={drafts[slot.slotId] ?? []}
                savedFrames={saved[slot.slotId] ?? []}
                overridden={overridden[slot.slotId] ?? false}
                open={open === `slot:${page.id}:${slot.slotId}`}
                onToggle={() => toggle(`slot:${page.id}:${slot.slotId}`)}
                onChange={(frames) => {
                  setMessage('');
                  setDrafts((current) => ({ ...current, [slot.slotId]: frames }));
                }}
              />
            ))}
          </ul>
        </section>
      ))}

      {sections.length ? (
        <section className="panel mediagroup">
          <header className="mediagroup__head">
            <h2 className="mediagroup__title">Homepage sections</h2>
            <p className="mediagroup__note">
              How tall each band is, and the ground it stands on. Both apply at every width.
            </p>
          </header>

          <ul className="mediagroup__list">
            {sections.map((section) => (
              <SectionRow
                key={section.id}
                label={section.label}
                setting={settings[section.id] ?? {}}
                savedSetting={savedSections[section.id] ?? {}}
                open={open === `section:${section.id}`}
                onToggle={() => toggle(`section:${section.id}`)}
                onChange={(next) => {
                  setMessage('');
                  setSettings((current) => ({ ...current, [section.id]: next }));
                }}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/**
 * Every photograph the storefront uses, as a list.
 *
 * A register rather than a rehearsal. This was a full-screen frame of the shop
 * with the controls beside it, and the frame was doing two jobs badly: it took
 * the whole screen to show one page at a time, and a crop judged against a
 * desktop-shaped preview is a crop the phone never got a say in. So the page
 * goes and the list stays — every image on the homepage and on Why Shrinkless,
 * each one replaceable by upload or by address, each one cropped for the desk
 * and for the phone against the shapes the layout actually renders it at.
 *
 * A slot standing on both pages is listed under both and is still one record:
 * editing it from either place moves both, which is what the storefront does
 * with it.
 *
 * Nothing reaches the shop until Publish, and a publish changes what the
 * server would send — so the editor refreshes and remounts, and the drafts
 * start again from what came back.
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
