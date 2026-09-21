'use client';

import { useState } from 'react';
import {
  SECTION_COLOURS,
  SECTION_COLOUR_IDS,
  isSectionColourName,
  normaliseSectionColour,
  sectionColourHex,
  sectionColourLabel,
  type SectionSetting,
} from '@/lib/media/colours';

/** The height a section is drawn at, or 0 while the design's own still stands. */
export const AUTO = 0;

const HEIGHT_MAX = 1600;

/** Two settings are the same when neither half differs — an absent colour and
 *  an absent height being what a section starts as. */
export function sameSetting(a: SectionSetting, b: SectionSetting): boolean {
  return (a.height ?? AUTO) === (b.height ?? AUTO) && (a.background ?? '') === (b.background ?? '');
}

/** What the storefront is serving for a section, in words — the line under the
 *  row's title, which is the only place the admin sees the published state
 *  rather than the draft. */
export function describe(setting: SectionSetting): string {
  const parts: string[] = [];

  if (setting.height) parts.push(`${setting.height}px`);
  if (setting.background) parts.push(sectionColourLabel(setting.background));

  return parts.length ? parts.join(' · ') : 'As the page sets it';
}

/**
 * One band across the homepage: the ground it stands on, and how tall it is.
 *
 * One height, not a per-device pair. The admin sets a number and it applies
 * everywhere — a phone and a desk holding different numbers would be two
 * settings pretending to be one. That is the rule the published stylesheet is
 * built under; see `sectionRules`.
 */
export function SectionRow({
  label,
  setting,
  savedSetting,
  open,
  onToggle,
  onChange,
}: {
  label: string;
  setting: SectionSetting;
  savedSetting: SectionSetting;
  open: boolean;
  onToggle: () => void;
  onChange: (setting: SectionSetting) => void;
}) {
  const height = setting.height ?? AUTO;
  const background = setting.background;
  const edited = !sameSetting(setting, savedSetting);

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
  function choose(next: SectionSetting['background']) {
    setTyped(null);
    patch({ background: next });
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
    <li className={`mediarow mediarow--section${open ? ' mediarow--open' : ''}`}>
      <div className="mediarow__head">
        <button
          type="button"
          className="mediarow__toggle"
          onClick={onToggle}
          aria-expanded={open}
        >
          <span
            className="mediarow__ground"
            style={{ background: sectionColourHex(background) || undefined }}
            aria-hidden="true"
          />

          <span className="mediarow__titles">
            <span className="mediaslot__title">{label}</span>
            <span className="mediaslot__where">{describe(setting)}</span>
          </span>
        </button>

        <div className="mediarow__marks">
          <button type="button" className="abtn abtn--quiet abtn--sm" onClick={onToggle}>
            {open ? 'Done' : 'Edit'}
          </button>
        </div>
      </div>

      {open ? (
        <div className="mediarow__panel">
          <div className="mediaslot__fields">
            {/* The site's own three first, because a band that matches one of
                them is the usual answer, and then the whole spectrum for the
                ones that are dressed for a season. Named grounds are stored by
                name and follow a re-tint; a colour picked here is stored as it
                stands. */}
            <fieldset className="adfield mediarow__colours">
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

              {/* The wheel and the hex are the same setting twice: one for
                  picking a colour by eye, one for a value carried in from a
                  brand sheet. */}
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
                The first three are the grounds the rest of the site is built on, and move with it
                if the brand is ever re-tinted. Any other colour is kept exactly as picked — the
                type on this band is dark, so leave it something dark ink can be read against.
              </small>
            </fieldset>

            <label className="adfield">
              Height
              <div className="mediarow__height">
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
                <span className="mediarow__unit">px</span>
              </div>
              <small>
                Zero gives the section back the height the page gives it. The number applies at
                every width.
              </small>
            </label>
          </div>

          <div className="mediaslot__foot">
            <button
              type="button"
              className="abtn abtn--quiet abtn--sm"
              onClick={() => restore(savedSetting)}
              disabled={!edited}
            >
              Undo my changes
            </button>

            <button
              type="button"
              className="abtn abtn--quiet abtn--sm"
              onClick={() => restore({})}
              disabled={!height && !background}
            >
              Back to the page&rsquo;s own
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
