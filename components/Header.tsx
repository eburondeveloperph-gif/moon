/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useUI } from '@/lib/state';
import { logout } from '@/lib/firebase';

export default function Header() {
  const { toggleSidebar } = useUI();

  return (
    <header>
      <div className="header-left">
        <div className="header-brand-mark">
          <span className="header-brand-dot" />
          <div>
            <p className="header-eyebrow">Beatrice Playground</p>
            <h1 className="header-title">Live session</h1>
          </div>
        </div>
      </div>
      <div className="header-right">
        <button
          className="settings-button"
          onClick={logout}
          aria-label="Logout"
        >
          <span className="material-symbols-outlined">logout</span>
        </button>
        <button
          className="settings-button"
          onClick={toggleSidebar}
          aria-label="Settings"
        >
          <span className="material-symbols-outlined">tune</span>
        </button>
      </div>
    </header>
  );
}
