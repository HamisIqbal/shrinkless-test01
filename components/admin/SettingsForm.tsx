'use client';

import { useState, useTransition } from 'react';
import { saveSettingsAction } from '@/app/actions/admin/settings';
import type { SettingsDTO } from '@/types/dto';

type Zone = SettingsDTO['shippingZones'][number];

export function SettingsForm({ settings }: { settings: SettingsDTO }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [storeEmail, setStoreEmail] = useState(settings.storeEmail);
  const [announcement, setAnnouncement] = useState(settings.announcement);
  const [zones, setZones] = useState<Zone[]>(settings.shippingZones);
  const [threshold, setThreshold] = useState(
    settings.freeShippingThresholdCents === null ? '' : String(settings.freeShippingThresholdCents),
  );
  const [lowStock, setLowStock] = useState(String(settings.lowStockThreshold));
  const [taxMode, setTaxMode] = useState(settings.taxMode);
  const [taxRate, setTaxRate] = useState(String(settings.flatTaxRateBasisPoints));

  function updateZone(index: number, patch: Partial<Zone>) {
    setZones(zones.map((zone, i) => (i === index ? { ...zone, ...patch } : zone)));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');

    startTransition(async () => {
      const result = await saveSettingsAction({
        storeEmail,
        announcement,
        shippingZones: zones,
        freeShippingThresholdCents: threshold === '' ? null : Number(threshold),
        lowStockThreshold: Number(lowStock),
        taxMode,
        flatTaxRateBasisPoints: Number(taxRate),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage('Settings saved.');
    });
  }

  return (
    <form onSubmit={handleSubmit} className="settings">
      <div className="settings__group">
        <div className="settings__aside">
          <h2 className="settings__grouptitle">Storefront</h2>
          <p className="settings__groupnote">
            What shoppers see: the address in the footer and the line above the
            header.
          </p>
        </div>

        <div className="settings__fields">
          <label className="adfield">
            Store email
            <input
              type="email"
              value={storeEmail}
              onChange={(e) => setStoreEmail(e.target.value)}
              required
            />
          </label>

          <label className="adfield">
            Announcement bar
            <input
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
              placeholder="Leave blank to hide the bar"
            />
          </label>
        </div>
      </div>

      <div className="settings__group">
        <div className="settings__aside">
          <h2 className="settings__grouptitle">Inventory</h2>
          <p className="settings__groupnote">
            The store-wide rule for what counts as running low. Any variant can
            override it.
          </p>
        </div>

        <div className="settings__fields">
          <label className="adfield">
            Low-stock threshold
            <input
              type="number"
              min={0}
              value={lowStock}
              onChange={(e) => setLowStock(e.target.value)}
            />
            <small>Units at or below this count as low.</small>
          </label>
        </div>
      </div>

      <div className="settings__group">
        <div className="settings__aside">
          <h2 className="settings__grouptitle">Shipping zones</h2>
          <p className="settings__groupnote">
            The legacy rate table. It is only consulted when no shipping method
            is configured — set those up on the Shipping screen instead.
          </p>
        </div>

        <div className="settings__fields">
          {zones.map((zone, index) => (
            <div key={index} className="panel panel--tight" style={{ marginBottom: 'var(--ad-s-3)' }}>
              <div className="fieldrow">
                <label className="adfield">
                  Name
                  <input
                    value={zone.name}
                    onChange={(e) => updateZone(index, { name: e.target.value })}
                  />
                </label>

                <label className="adfield">
                  Rate, in cents
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={zone.rateCents}
                    onChange={(e) => updateZone(index, { rateCents: Number(e.target.value) })}
                  />
                </label>
              </div>

              <label className="adfield">
                States
                <input
                  value={zone.states.join(', ')}
                  onChange={(e) =>
                    updateZone(index, {
                      states: e.target.value
                        .split(',')
                        .map((part) => part.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="TX, CA — blank matches everywhere"
                />
              </label>

              <button
                type="button"
                className="abtn abtn--quiet abtn--sm"
                onClick={() => setZones(zones.filter((_, i) => i !== index))}
              >
                Remove zone
              </button>
            </div>
          ))}

          <button
            type="button"
            className="abtn abtn--ghost"
            onClick={() => setZones([...zones, { name: '', states: [], rateCents: 0 }])}
          >
            Add zone
          </button>

          <label className="adfield" style={{ marginTop: 'var(--ad-s-4)' }}>
            Free shipping threshold, in cents
            <input
              type="number"
              min={0}
              step={1}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="Blank for none"
            />
            <small>Applies store-wide, whichever method is chosen.</small>
          </label>
        </div>
      </div>

      <div className="settings__group">
        <div className="settings__aside">
          <h2 className="settings__grouptitle">Tax</h2>
          <p className="settings__groupnote">
            Stripe Tax charges nothing here — the provider calculates at
            checkout, and a guess would contradict it.
          </p>
        </div>

        <div className="settings__fields">
          <div className="fieldrow">
            <label className="adfield">
              Tax mode
              <select
                value={taxMode}
                onChange={(e) => setTaxMode(e.target.value as SettingsDTO['taxMode'])}
              >
                <option value="none">None</option>
                <option value="flat">Flat rate</option>
                <option value="stripe">Stripe Tax</option>
              </select>
            </label>

            <label className="adfield">
              Flat rate, in basis points
              <input
                type="number"
                min={0}
                max={10000}
                step={1}
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                disabled={taxMode !== 'flat'}
              />
              <small>825 is 8.25%.</small>
            </label>
          </div>
        </div>
      </div>

      <div className="editor__save">
        {message ? <p role="status" className="editor__savemsg">{message}</p> : null}
        {error ? <p role="alert" className="editor__savemsg">{error}</p> : null}

        <button type="submit" className="abtn" disabled={pending}>
          {pending ? 'Saving' : 'Save settings'}
        </button>
      </div>
    </form>
  );
}
