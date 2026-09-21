'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { publishMediaAction } from '@/app/actions/admin/media';
import { MediaSlotRow, sameFrames, type Frame } from '@/components/admin/MediaSlotRow';
import { AUTO, SectionRow, sameSetting } from '@/components/admin/SectionRow';
import { UnsavedBar } from '@/components/admin/UnsavedBar';
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

function Editor({
  pages,
  savedAt,
  onPublished,
}: {
  pages: MediaPageView[];
  /** When the last save landed, so the bar can confirm it across a remount. */
  savedAt: number;
  onPublished: () => void;
}) {
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

  const [open, setOpen] = useState<OpenKey>('');
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

  /**
   * A refusal, named after the image it is about, with that image opened.
   *
   * The validator answers with a path — `slots.2.frames.0.alt` — and on its
   * own "Alt text is required" gives no clue which of twenty photographs is
   * holding the publish up.
   */
  function where(fieldErrors: Record<string, string> | undefined): string | null {
    const [path, message] = Object.entries(fieldErrors ?? {})[0] ?? [];
    const match = path?.match(/^slots\.(\d+)\.frames\.(\d+)\./);
    const slot = match ? dirtySlots[Number(match[1])] : undefined;

    if (!slot || !message) return null;

    const page = pages.find((candidate) =>
      candidate.slots.some((listed) => listed.slotId === slot.slotId),
    );
    if (page) setOpen(`slot:${page.id}:${slot.slotId}`);

    const frame = slot.frames.length > 1 ? `, frame ${Number(match![2]) + 1}` : '';
    return `${slot.label}${frame}: ${message}`;
  }

  /** Everything changed anywhere in the list, in one write. Nothing before now
   *  has touched the storefront. */
  function publish() {
    setError('');

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
      let result: Awaited<ReturnType<typeof publishMediaAction>>;

      /* A thrown action — a dropped connection, a server that fell over —
         used to escape the transition and leave the button doing nothing
         visible. It is a failed publish like any other, and says so. */
      try {
        result = await publishMediaAction(payload);
      } catch {
        setError('Could not reach the server to save. Check the connection and try again.');
        return;
      }

      if (!result.ok) {
        setError(where(result.fieldErrors) ?? result.error);
        return;
      }

      onPublished();
    });
  }

  return (
    <div className="medialist">
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
                open={open === `slot:${page.id}:${slot.slotId}`}
                onToggle={() => toggle(`slot:${page.id}:${slot.slotId}`)}
                range={slot.range}
                onChange={(frames) => {
                  setError('');
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
                  setError('');
                  setSettings((current) => ({ ...current, [section.id]: next }));
                }}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <UnsavedBar
        count={dirty}
        pending={pending}
        error={error}
        savedAt={savedAt}
        onSave={publish}
        onCancel={() => {
          setError('');
          setDrafts(saved);
          setSettings(savedSections);
        }}
      />
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
 * Nothing reaches the shop until Save — the bar along the bottom of the
 * screen asks as soon as anything differs — and a save changes what the
 * server would send — so the drafts start again from what came back. The
 * editor is keyed on that data rather than on a counter bumped at publish
 * time: the counter remounted it before the refreshed data had arrived, the
 * drafts were rebuilt from the old values, and when the new ones landed the
 * list compared the two and offered "Publish (1)" for a change already live.
 *
 * The confirmation lives out here for the same reason — a remount is exactly
 * when it has to survive.
 */
export function MediaManager({ pages }: { pages: MediaPageView[] }) {
  const router = useRouter();
  const [savedAt, setSavedAt] = useState(0);
  const fingerprint = useMemo(() => JSON.stringify(pages), [pages]);

  return (
    <Editor
      key={fingerprint}
      pages={pages}
      savedAt={savedAt}
      onPublished={() => {
        setSavedAt(Date.now());
        router.refresh();
      }}
    />
  );
}
