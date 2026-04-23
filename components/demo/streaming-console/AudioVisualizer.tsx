import type { CSSProperties } from 'react';
import { useMemo } from 'react';
import { useLiveAPIContext } from '@/contexts/LiveAPIContext';
import { useUI } from '@/lib/state';

const clampLevel = (value: number) => Math.max(0, Math.min(value, 1));

export default function AudioVisualizer() {
  const { connected, volume } = useLiveAPIContext();
  const micLevel = useUI(state => state.micLevel);

  const inputLevel = clampLevel(micLevel * 1.8);
  const outputLevel = clampLevel(volume * 1.5);
  const energy = connected ? Math.max(0.12, inputLevel, outputLevel * 0.92) : 0.08;

  const bars = useMemo(
    () =>
      Array.from({ length: 24 }, (_, index) => {
        const position = index / 23;
        const symmetry = 1 - Math.abs(position - 0.5) * 1.8;
        const pulse = (Math.sin(index * 1.33 + energy * 6) + 1) / 2;
        const amplitude = clampLevel(0.18 + symmetry * 0.42 + pulse * 0.14);
        const sourceMix = index % 2 === 0 ? inputLevel : outputLevel;
        const height = clampLevel(0.14 + energy * amplitude + sourceMix * 0.35);

        return {
          id: index,
          height,
          delay: `${index * 28}ms`,
        };
      }),
    [energy, inputLevel, outputLevel],
  );

  return (
    <section className="audio-visualizer-panel glass" aria-label="Audio visualizer">
      <div className="audio-visualizer-stage">
        <div className="audio-orb-shell">
          <div
            className={`audio-orb-core ${connected ? 'connected' : ''}`}
            style={{ '--orb-scale': `${0.92 + energy * 0.5}` } as CSSProperties}
          >
            <span className="material-symbols-outlined">graphic_eq</span>
          </div>
          <div className="audio-orb-ring audio-orb-ring-inner" />
          <div className="audio-orb-ring audio-orb-ring-outer" />
        </div>

        <div className="audio-bars" aria-hidden="true">
          {bars.map(bar => (
            <span
              key={bar.id}
              className="audio-bar"
              style={
                {
                  '--bar-height': `${18 + bar.height * 82}px`,
                  '--bar-delay': bar.delay,
                } as CSSProperties
              }
            />
          ))}
        </div>
      </div>

      <div className="audio-visualizer-meta">
        <div className="audio-channel-card">
          <span className="audio-channel-label">Mic Input</span>
          <strong>{Math.round(inputLevel * 100)}%</strong>
        </div>
        <div className="audio-channel-card">
          <span className="audio-channel-label">Voice Output</span>
          <strong>{Math.round(outputLevel * 100)}%</strong>
        </div>
        <div className="audio-channel-card audio-channel-card-status">
          <span className="audio-channel-label">Session</span>
          <strong>{connected ? 'Connected' : 'Standby'}</strong>
        </div>
      </div>
    </section>
  );
}
