import { useEffect, useState } from 'react';
import { RollEvent } from '../types/character';
import { X } from 'lucide-react';

interface Props {
  rollEvent: RollEvent | null;
  onClose: () => void;
}

export const DiceRollOverlay = ({ rollEvent, onClose }: Props) => {
  const [isRolling, setIsRolling] = useState(true);
  const [displayNumber, setDisplayNumber] = useState<number>(1);

  useEffect(() => {
    if (!rollEvent) return;

    setIsRolling(true);

    const interval = setInterval(() => {
      setDisplayNumber(Math.floor(Math.random() * 20) + 1);
    }, 60);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      setDisplayNumber(rollEvent.roll);
      setIsRolling(false);
    }, 1000);

    const closeTimeout = setTimeout(() => {
      onClose();
    }, 4000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
      clearTimeout(closeTimeout);
    };
  }, [rollEvent]);

  if (!rollEvent) return null;

  const isSuccess = rollEvent.isSuccess;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div
        className={`w-full max-w-[280px] rounded-lg p-4 border shadow-2xl transition-all duration-300 transform flex flex-col items-center text-center relative ${
          isRolling
            ? 'bg-liminal-card border-gray-700 shadow-black'
            : isSuccess
            ? 'bg-emerald-950/90 border-emerald-500 shadow-emerald-900/40 ring-1 ring-emerald-400'
            : 'bg-red-950/90 border-red-600 shadow-red-950/40 ring-1 ring-red-500'
        }`}
      >
        {/* Cerrar */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-white transition-colors p-1"
        >
          <X size={14} />
        </button>

        {/* Identidad del personaje / PNJ y atributo */}
        <div className="mb-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-gray-300 font-bold truncate max-w-[220px]">
            {rollEvent.characterName}
          </div>
          <div className="text-[10px] font-mono text-gray-400">
            {rollEvent.attrName} ({rollEvent.attrValue})
          </div>
        </div>

        {/* D20 Minimalista Animado */}
        <div className="relative my-2 flex items-center justify-center">
          <svg
            viewBox="0 0 100 100"
            className={`w-20 h-20 transition-transform duration-700 ${
              isRolling ? 'animate-spin-slow text-gray-400' : isSuccess ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            <polygon
              points="50,5 90,27 90,73 50,95 10,73 10,27"
              fill="rgba(15, 17, 21, 0.85)"
              stroke="currentColor"
              strokeWidth="3"
            />
            <polygon
              points="50,22 80,70 20,70"
              fill={isRolling ? 'rgba(40,45,60,0.5)' : isSuccess ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}
              stroke="currentColor"
              strokeWidth="2"
            />
            <line x1="50" y1="5" x2="50" y2="22" stroke="currentColor" strokeWidth="2" />
            <line x1="10" y1="27" x2="20" y2="70" stroke="currentColor" strokeWidth="2" />
            <line x1="90" y1="27" x2="80" y2="70" stroke="currentColor" strokeWidth="2" />
            <line x1="50" y1="95" x2="20" y2="70" stroke="currentColor" strokeWidth="2" />
            <line x1="50" y1="95" x2="80" y2="70" stroke="currentColor" strokeWidth="2" />
          </svg>

          <span
            className={`absolute font-mono font-black select-none pointer-events-none transition-all duration-200 ${
              isRolling ? 'text-xl text-gray-300' : 'text-2xl text-white'
            }`}
          >
            {displayNumber}
          </span>
        </div>

        {/* Veredicto minimalista: sólo ÉXITO o FALLO */}
        <div className="font-mono">
          {isRolling ? (
            <span className="text-[11px] text-gray-400 uppercase tracking-widest animate-pulse">
              Tirando...
            </span>
          ) : (
            <div
              className={`text-base font-black tracking-widest uppercase ${
                isSuccess ? 'text-emerald-300' : 'text-red-300'
              }`}
            >
              {isSuccess ? 'ÉXITO' : 'FALLO'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
