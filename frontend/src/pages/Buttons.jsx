import { useEffect, useState } from 'react';
import Button from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import '../styles/buttons-preview.css';

/**
 * Temporary review page for the Button primitive (spec step 3: build one Button
 * and show it). Delete once the primitives are migrated into the pages.
 *
 * The theme toggle drives the real `<html data-theme>`, because that is where
 * lib/theme.js puts it and where the token blocks in styles/tokens.css match.
 */
export default function Buttons() {
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme || 'light',
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const sizes = ['sm', 'md', 'lg', 'xl'];
  const variants = ['primary', 'secondary', 'tertiary', 'danger'];

  return (
    <div className="bp">
      <header className="bp-bar">
        <h1 className="bp-title">Button, section 7.1</h1>
        <div className="bp-toggle" role="group" aria-label="Theme">
          {['light', 'dark'].map((t) => (
            <button
              key={t}
              type="button"
              className={`bp-toggle-btn${theme === t ? ' is-on' : ''}`}
              onClick={() => setTheme(t)}
              aria-pressed={theme === t}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      <section className="bp-block">
        <h2 className="bp-h2">Sizes</h2>
        <p className="bp-note">32 / 40 / 48 / 56px tall, pill radius, flat amber.</p>
        <div className="bp-row">
          {sizes.map((s) => (
            <Button key={s} size={s}>{s}</Button>
          ))}
        </div>
      </section>

      <section className="bp-block">
        <h2 className="bp-h2">Variants</h2>
        <div className="bp-row">
          {variants.map((v) => (
            <Button key={v} variant={v} size="md">{v}</Button>
          ))}
        </div>
      </section>

      <section className="bp-block">
        <h2 className="bp-h2">Icons and states</h2>
        <div className="bp-row">
          <Button icon="send" size="lg">Send message</Button>
          <Button variant="secondary" iconAfter="arrowRight" size="lg">Continue</Button>
          <Button loading size="lg">Saving</Button>
          <Button disabled size="lg">Disabled</Button>
          <Button variant="danger" icon="trash" size="lg">Delete</Button>
          <Button icon="gear" size="lg" aria-label="Settings" />
        </div>
      </section>

      <section className="bp-block">
        <h2 className="bp-h2">On surfaces, 16 and 24px icons</h2>
        <div className="bp-row">
          <span className="bp-chip"><Icon name="sparkle" size={16} /> small 16</span>
          <span className="bp-chip"><Icon name="sparkle" /> default 20</span>
          <span className="bp-chip"><Icon name="sparkle" size={24} /> large 24</span>
        </div>
        <div className="bp-row">
          <Button variant="primary" size="xl" fullWidth>Full width, 56px</Button>
        </div>
      </section>
    </div>
  );
}