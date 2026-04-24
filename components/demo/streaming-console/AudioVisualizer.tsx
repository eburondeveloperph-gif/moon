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
    <div className="flex-1 flex items-center gap-1.5 h-12 px-6 overflow-hidden">
      {bars.map(bar => (
        <div 
          key={bar.id}
          className="w-1.5 bg-dim rounded-full bar-anim"
          style={{ 
            height: `${20 + bar.height * 80}%`, 
            animationDelay: `-${Math.random() * 1.5}s`,
            background: connected ? '#3b82f6' : '#64748b',
            opacity: connected ? 0.8 : 0.4
          } as CSSProperties}
        />
      ))}
    </div>
  );
}
