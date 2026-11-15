import React, { useEffect, useState, useRef } from 'react';
import {
  LiminalCharacter,
  DEFAULT_CHARACTER,
  RollEvent
} from './types/character';
import {
  initOBR,
  savePlayerCharacter,
  broadcastDiceRoll,
  notifyOBR,
  OBRState
} from './obr/obrManager';
import { DiceRollOverlay } from './components/DiceRollOverlay';
import {
  Save,
  Plus,
  X,
  ExternalLink,
  Dices,
  ChevronLeft,
  RotateCcw
} from 'lucide-react';

export default function App() {
  const [obrState, setObrState] = useState<OBRState>({
    isReady: false,
    role: 'PLAYER',
    playerId: 'local-player',
    playerName: 'Jugador'
  });

  const [allCharacters, setAllCharacters] = useState<Record<string, LiminalCharacter>>({});
  const [character, setCharacter] = useState<LiminalCharacter>(DEFAULT_CHARACTER);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [activeRoll, setActiveRoll] = useState<RollEvent | null>(null);
  const [lastRolledAttr, setLastRolledAttr] = useState<{ key: string; isSuccess: boolean } | null>(null);

  // Estados para la tirada de PNJ del Guardián (GM)
  const [npcName, setNpcName] = useState<string>('PNJ / Criatura');
  const [npcTarget, setNpcTarget] = useState<number>(10);

  const isInitializedRef = useRef<boolean>(false);

  // Inicializar OBR
  useEffect(() => {
    initOBR(
      (state) => {
        setObrState(state);
      },
      (incomingChars) => {
        setAllCharacters((prev) => ({
          ...prev,
          ...incomingChars
        }));
      },
      (incomingRoll) => {
        setActiveRoll(incomingRoll);
        setLastRolledAttr({
          key: incomingRoll.attrKey,
          isSuccess: incomingRoll.isSuccess
        });
      }
    );
  }, []);

  const isGM = obrState.role === 'GM';
  const currentTargetPlayerId = editingPlayerId || (isGM ? null : obrState.playerId);

  // Sincronizar ficha activa
  useEffect(() => {
    if (!obrState.playerId) return;

    if (currentTargetPlayerId && allCharacters[currentTargetPlayerId]) {
      const char = allCharacters[currentTargetPlayerId];
      const cleanInv = Array.from({ length: 10 }, (_, i) => char.inventory?.[i] || null);
      setCharacter({
        ...char,
        hp: {
          current: Math.min(char.hp.current, Math.min(10, char.hp.max)),
          max: Math.min(10, char.hp.max)
        },
        armor: Math.min(4, Math.max(0, char.armor ?? 0)),
        stability: Math.min(3, Math.max(0, char.stability ?? 0)),
        inventory: cleanInv
      });
      setHasUnsavedChanges(false);
      isInitializedRef.current = true;
    } else if (!isGM && currentTargetPlayerId && !isInitializedRef.current) {
      // Auto-registrar la ficha sólo para jugadores regulares (el GM no crea ficha propia)
      const initialChar: LiminalCharacter = {
        ...DEFAULT_CHARACTER,
        id: currentTargetPlayerId,
        playerId: currentTargetPlayerId,
        playerName: obrState.playerName,
        name: `Investigador (${obrState.playerName})`
      };
      setCharacter(initialChar);
      savePlayerCharacter(currentTargetPlayerId, initialChar);
      isInitializedRef.current = true;
    }
  }, [currentTargetPlayerId, allCharacters[currentTargetPlayerId || ''], isGM]);

  // Auto-guardado debounced
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerAutoSave = (updatedChar: LiminalCharacter) => {
    if (!currentTargetPlayerId) return;
    setHasUnsavedChanges(true);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      await savePlayerCharacter(currentTargetPlayerId, {
        ...updatedChar,
        playerId: currentTargetPlayerId,
        playerName: updatedChar.playerName || obrState.playerName
      });
      setHasUnsavedChanges(false);
    }, 500);
  };

  // Guardado manual
  const handleManualSave = async () => {
    if (!currentTargetPlayerId) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    const success = await savePlayerCharacter(currentTargetPlayerId, {
      ...character,
      playerId: currentTargetPlayerId,
      playerName: character.playerName || obrState.playerName
    });
    if (success) {
      setHasUnsavedChanges(false);
      notifyOBR(`Ficha de "${character.name}" guardada.`, 'SUCCESS');
    }
  };

  // Tirada de salvación al presionar un atributo de jugador (d20 <= Atributo)
  const handleRollAttribute = async (key: 'str' | 'dex' | 'ctrl') => {
    const targetValue = character.attributes[key].current;
    const roll = Math.floor(Math.random() * 20) + 1;
    const isSuccess = roll <= targetValue;

    const rollEvent: RollEvent = {
      id: `${Date.now()}-${Math.random()}`,
      playerId: obrState.playerId,
      playerName: character.playerName || obrState.playerName,
      characterName: character.name || 'Investigador',
      attrKey: key,
      attrName: key.toUpperCase(),
      attrValue: targetValue,
      roll,
      isSuccess,
      timestamp: Date.now()
    };

    setActiveRoll(rollEvent);
    setLastRolledAttr({ key, isSuccess });
    await broadcastDiceRoll(rollEvent);
  };

  // Tirada de PNJ para el Game Master
  const handleRollNpc = async (attrLabel: string) => {
    const roll = Math.floor(Math.random() * 20) + 1;
    const target = Math.max(1, Math.min(19, npcTarget));
    const isSuccess = roll <= target;

    const rollEvent: RollEvent = {
      id: `${Date.now()}-${Math.random()}`,
      playerId: obrState.playerId,
      playerName: 'Guardián (GM)',
      characterName: npcName.trim() || 'PNJ',
      attrKey: 'npc',
      attrName: attrLabel,
      attrValue: target,
      roll,
      isSuccess,
      timestamp: Date.now()
    };

    setActiveRoll(rollEvent);
    await broadcastDiceRoll(rollEvent);
  };

  // Manejador de atributos con restricciones: Max <= 19, Current <= Max
  const updateAttr = (key: 'str' | 'dex' | 'ctrl', field: 'current' | 'max', rawVal: number) => {
    const val = isNaN(rawVal) ? 0 : rawVal;
    const currentMax = character.attributes[key].max;
    const currentVal = character.attributes[key].current;

    let newMax = currentMax;
    let newCurrent = currentVal;

    if (field === 'max') {
      newMax = Math.max(1, Math.min(19, val));
      if (newCurrent > newMax) newCurrent = newMax;
    } else {
      newCurrent = Math.max(0, Math.min(currentMax, val));
    }

    const updated = {
      ...character,
      attributes: {
        ...character.attributes,
        [key]: { current: newCurrent, max: newMax }
      }
    };
    setCharacter(updated);
    triggerAutoSave(updated);
  };

  // Manejador de HP: Max <= 10, Current <= Max
  const updateHP = (field: 'current' | 'max', rawVal: number) => {
    const val = isNaN(rawVal) ? 0 : rawVal;
    let newMax = character.hp.max;
    let newCurrent = character.hp.current;

    if (field === 'max') {
      newMax = Math.max(1, Math.min(10, val));
      if (newCurrent > newMax) newCurrent = newMax;
    } else {
      newCurrent = Math.max(0, Math.min(newMax, val));
    }

    const updated = {
      ...character,
      hp: { current: newCurrent, max: newMax }
    };
    setCharacter(updated);
    triggerAutoSave(updated);
  };

  // Recuperar HP al máximo al hacer clic en el nombre "HP"
  const restoreHpToMax = () => {
    const updated = {
      ...character,
      hp: { ...character.hp, current: character.hp.max }
    };
    setCharacter(updated);
    triggerAutoSave(updated);
    notifyOBR(`${character.name}: HP restaurado al máximo (${character.hp.max}).`, 'SUCCESS');
  };

  // Armadura: 0 a 4
  const updateArmor = (rawVal: number) => {
    const val = isNaN(rawVal) ? 0 : rawVal;
    const clamped = Math.max(0, Math.min(4, val));
    const updated = { ...character, armor: clamped };
    setCharacter(updated);
    triggerAutoSave(updated);
  };

  // Estabilidad: 0 a 3
  const updateStability = (rawVal: number) => {
    const val = isNaN(rawVal) ? 0 : rawVal;
    const clamped = Math.max(0, Math.min(3, val));
    const updated = { ...character, stability: clamped };
    setCharacter(updated);
    triggerAutoSave(updated);
  };

  // Manejador de inventario
  const updateSlotText = (index: number, text: string) => {
    const newInv = [...character.inventory];
    if (!text.trim() && !newInv[index]?.isFatigue) {
      newInv[index] = null;
    } else {
      newInv[index] = {
        id: newInv[index]?.id || `slot-${index}-${Date.now()}`,
        name: text,
        isFatigue: newInv[index]?.isFatigue || false,
        isBulky: newInv[index]?.isBulky || false
      };
    }
    const updated = { ...character, inventory: newInv };
    setCharacter(updated);
    triggerAutoSave(updated);
  };

  const toggleFatigue = (index: number) => {
    const newInv = [...character.inventory];
    const currentSlot = newInv[index];

    if (!currentSlot) {
      newInv[index] = {
        id: `slot-${index}-${Date.now()}`,
        name: 'Fatiga',
        isFatigue: true
      };
    } else if (currentSlot.isFatigue) {
      if (currentSlot.name === 'Fatiga') {
        newInv[index] = null;
      } else {
        newInv[index] = { ...currentSlot, isFatigue: false };
      }
    } else {
      newInv[index] = { ...currentSlot, isFatigue: true };
    }

    const updated = { ...character, inventory: newInv };
    setCharacter(updated);
    triggerAutoSave(updated);
  };

  const clearSlot = (index: number) => {
    const newInv = [...character.inventory];
    newInv[index] = null;
    const updated = { ...character, inventory: newInv };
    setCharacter(updated);
    triggerAutoSave(updated);
  };

  const addQuickItem = () => {
    const firstEmptyIndex = character.inventory.findIndex((s) => s === null);
    if (firstEmptyIndex === -1) {
      notifyOBR('Inventario lleno (10/10).', 'WARNING');
      return;
    }
    updateSlotText(firstEmptyIndex, 'Nuevo Ítem');
  };

  // Conteo de espacios ocupados en inventario (x/10)
  const occupiedSlotsCount = character.inventory.filter(
    (s) => s !== null && (s.name.trim() !== '' || s.isFatigue)
  ).length;

  const participantList = Object.entries(allCharacters);

  return (
    <div className="flex flex-col h-screen bg-liminal-bg text-gray-200 text-xs overflow-hidden font-sans relative">
      {/* Animación d20 minimalista en tiempo real */}
      <DiceRollOverlay rollEvent={activeRoll} onClose={() => setActiveRoll(null)} />

      {/* Encabezado */}
      <header className="px-3 py-1.5 bg-liminal-card border-b border-liminal-border flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-liminal-toxic animate-pulse" />
          <span className="font-mono font-bold text-xs tracking-wider uppercase text-gray-200">
            LIMINAL HORROR
          </span>
          <span className="text-[10px] font-mono text-gray-400">
            [{isGM ? 'GUARDIÁN' : obrState.playerName}]
          </span>
        </div>

        <div className="flex items-center space-x-1.5">
          {currentTargetPlayerId && (
            <button
              onClick={handleManualSave}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                hasUnsavedChanges
                  ? 'bg-liminal-accent hover:bg-red-700 text-white font-bold animate-pulse'
                  : 'bg-liminal-border hover:bg-gray-700 text-gray-300'
              }`}
              title="Sincronizar cambios en la sala"
            >
              <Save size={12} />
              <span>{hasUnsavedChanges ? 'Sincronizando...' : 'Guardado'}</span>
            </button>
          )}
        </div>
      </header>

      {/* VISTA DEL GUARDiÁN (GM): Panel de Mesa & Tiradas de PNJ */}
      {isGM && !editingPlayerId ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Herramienta de Tirada de PNJ para el GM */}
          <div className="bg-liminal-card border border-liminal-border rounded p-2.5 space-y-2">
            <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider flex items-center space-x-1">
              <Dices size={12} className="text-liminal-toxic" />
              <span>Tirada de PNJ / Criatura</span>
            </span>

            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={npcName}
                onChange={(e) => setNpcName(e.target.value)}
                placeholder="Nombre del PNJ (ej. Cultista)"
                className="bg-black/40 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-liminal-accent flex-1 font-sans"
              />
              <div className="flex items-center space-x-1 font-mono text-xs">
                <span className="text-gray-400 text-[10px]">Obj (≤19):</span>
                <input
                  type="number"
                  value={npcTarget}
                  min={1}
                  max={19}
                  onChange={(e) => setNpcTarget(Math.max(1, Math.min(19, parseInt(e.target.value) || 10)))}
                  className="w-10 text-center bg-black/40 border border-gray-700 rounded py-1 font-bold text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5 pt-0.5">
              {(['STR', 'DEX', 'CTRL'] as const).map((attr) => (
                <button
                  key={attr}
                  onClick={() => handleRollNpc(attr)}
                  className="py-1 bg-black/40 hover:bg-liminal-accent text-gray-200 hover:text-white rounded border border-gray-700 text-xs font-mono font-bold transition-colors"
                >
                  Tirar {attr}
                </button>
              ))}
            </div>
          </div>

          {/* Listado de Investigadores de la Mesa */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-liminal-border pb-1">
              <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider">
                ESTADO DE LA MESA
              </span>
              <span className="text-[10px] font-mono text-liminal-toxic">
                {participantList.length} Jugador(es)
              </span>
            </div>

            {participantList.length === 0 ? (
              <div className="text-center py-10 text-gray-500 font-mono text-xs">
                Esperando a que los jugadores abran su extensión...
              </div>
            ) : (
              participantList.map(([pId, pChar]) => {
                const fatiguesCount = (pChar.inventory || []).filter((s) => s?.isFatigue).length;
                const isHPCritical = pChar.hp.current <= 0;

                return (
                  <div
                    key={pId}
                    className="bg-liminal-card border border-liminal-border rounded p-2.5 space-y-2 hover:border-gray-600 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-white text-xs flex items-center space-x-1.5">
                          <span>{pChar.name || 'Sin Nombre'}</span>
                          <span className="text-[10px] font-mono text-gray-400 font-normal">
                            ({pChar.playerName || 'Jugador'})
                          </span>
                        </div>
                        {pChar.concept && (
                          <div className="text-[10px] text-gray-400 italic">{pChar.concept}</div>
                        )}
                      </div>

                      <button
                        onClick={() => setEditingPlayerId(pId)}
                        className="px-2 py-0.5 bg-black/40 hover:bg-liminal-border border border-gray-700 text-gray-300 rounded text-[10px] font-mono flex items-center space-x-1"
                        title="Ver y editar ficha"
                      >
                        <ExternalLink size={10} />
                        <span>Ficha</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 text-center font-mono">
                      <div
                        className={`p-1 rounded border ${
                          isHPCritical
                            ? 'bg-red-950/60 border-red-800 text-red-200'
                            : 'bg-black/30 border-gray-800 text-gray-200'
                        }`}
                      >
                        <div className="text-[8px] text-gray-400 uppercase">HP</div>
                        <div className="font-bold text-xs">
                          {pChar.hp.current} / {pChar.hp.max}
                        </div>
                      </div>

                      <div className="p-1 rounded bg-black/30 border border-gray-800 text-gray-200">
                        <div className="text-[8px] text-blue-400 uppercase">Armadura</div>
                        <div className="font-bold text-xs">{pChar.armor}</div>
                      </div>

                      <div className="p-1 rounded bg-black/30 border border-gray-800 text-gray-200">
                        <div className="text-[8px] text-purple-400 uppercase">Estabilidad</div>
                        <div className="font-bold text-xs">{pChar.stability ?? 0}</div>
                      </div>

                      <div
                        className={`p-1 rounded border ${
                          fatiguesCount > 0
                            ? 'bg-red-950/40 border-red-900/60 text-red-300'
                            : 'bg-black/30 border-gray-800 text-gray-200'
                        }`}
                      >
                        <div className="text-[8px] text-gray-400 uppercase">Fatiga</div>
                        <div className="font-bold text-xs">{fatiguesCount} / 10</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-[10px] bg-black/20 p-1 rounded border border-gray-900">
                      <div>
                        <span className="text-gray-500 mr-1">STR:</span>
                        <span className="font-bold text-gray-200">
                          {pChar.attributes.str.current}/{pChar.attributes.str.max}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 mr-1">DEX:</span>
                        <span className="font-bold text-gray-200">
                          {pChar.attributes.dex.current}/{pChar.attributes.dex.max}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 mr-1">CTRL:</span>
                        <span className="font-bold text-gray-200">
                          {pChar.attributes.ctrl.current}/{pChar.attributes.ctrl.max}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* VISTA DE FICHA (Para Jugador, o para GM inspeccionando a un jugador) */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Si el GM está inspeccionando, barra de retorno a la Mesa */}
          {isGM && editingPlayerId && (
            <div className="bg-yellow-950/40 border-b border-yellow-800/60 px-3 py-1 flex items-center justify-between text-[11px] text-yellow-200 font-mono">
              <span>Inspeccionando ficha de: <strong>{character.playerName || 'Jugador'}</strong></span>
              <button
                onClick={() => setEditingPlayerId(null)}
                className="flex items-center space-x-1 hover:text-white underline text-[10px]"
              >
                <ChevronLeft size={12} />
                <span>Volver a la Mesa</span>
              </button>
            </div>
          )}

          {/* Identidad del Investigador */}
          <div className="px-3 py-1.5 bg-liminal-card/40 border-b border-liminal-border grid grid-cols-2 gap-2">
            <input
              type="text"
              value={character.name}
              onChange={(e) => {
                const updated = { ...character, name: e.target.value };
                setCharacter(updated);
                triggerAutoSave(updated);
              }}
              placeholder="Nombre del Investigador"
              className="bg-transparent font-bold text-xs text-white focus:outline-none focus:border-b border-liminal-accent truncate"
            />
            <input
              type="text"
              value={character.concept}
              onChange={(e) => {
                const updated = { ...character, concept: e.target.value };
                setCharacter(updated);
                triggerAutoSave(updated);
              }}
              placeholder="Concepto / Ocupación"
              className="bg-transparent text-[11px] text-gray-400 focus:outline-none focus:border-b border-gray-700 truncate text-right"
            />
          </div>

          {/* Mitad superior: ATRIBUTOS (Max <= 19) vs ESTADO (HP Max <= 10, Armadura <= 4, Estabilidad <= 3) */}
          <div className="p-2.5 grid grid-cols-2 gap-2 border-b border-liminal-border bg-liminal-bg">
            {/* Mitad Izquierda: STR, DEX, CTRL */}
            <div className="bg-liminal-card p-2 rounded border border-liminal-border flex flex-col justify-between space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono font-bold text-gray-400 uppercase tracking-widest">
                  ATRIBUTOS
                </span>
                <span className="text-[8px] font-mono text-gray-500">
                  (clic tira d20)
                </span>
              </div>

              {(['str', 'dex', 'ctrl'] as const).map((key) => {
                const label = key.toUpperCase();
                const attr = character.attributes[key];
                const wasLastRolled = lastRolledAttr?.key === key;

                return (
                  <div
                    key={key}
                    className={`flex items-center justify-between py-0.5 px-1 rounded transition-colors ${
                      wasLastRolled
                        ? lastRolledAttr?.isSuccess
                          ? 'bg-emerald-950/40 border border-emerald-600/50'
                          : 'bg-red-950/40 border border-red-600/50'
                        : 'hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleRollAttribute(key)}
                      className="flex items-center space-x-1.5 text-left group focus:outline-none"
                      title={`Tirar Salvación de ${label} (d20 ≤ ${attr.current})`}
                    >
                      <Dices
                        size={12}
                        className="text-gray-500 group-hover:text-liminal-toxic transition-transform group-hover:rotate-45"
                      />
                      <span className="font-mono font-bold text-xs text-gray-200 group-hover:text-white group-hover:underline">
                        {label}
                      </span>
                    </button>

                    <div className="flex items-center space-x-1 font-mono text-xs">
                      <input
                        type="number"
                        min={0}
                        max={attr.max}
                        value={attr.current}
                        onChange={(e) => updateAttr(key, 'current', parseInt(e.target.value))}
                        className="w-8 text-center bg-black/40 rounded border border-gray-700 py-0.5 font-bold text-white focus:border-liminal-accent focus:outline-none"
                        title="Valor actual (≤ Máximo)"
                      />
                      <span className="text-gray-600">/</span>
                      <input
                        type="number"
                        min={1}
                        max={19}
                        value={attr.max}
                        onChange={(e) => updateAttr(key, 'max', parseInt(e.target.value))}
                        className="w-8 text-center bg-black/40 rounded border border-gray-700 py-0.5 text-gray-400 focus:border-liminal-accent focus:outline-none"
                        title="Valor máximo (≤ 19)"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mitad Derecha: HP, Armadura, Estabilidad */}
            <div className="bg-liminal-card p-2 rounded border border-liminal-border flex flex-col justify-between space-y-1.5">
              <span className="text-[9px] font-mono font-bold text-gray-400 uppercase tracking-widest">
                ESTADO
              </span>

              {/* HP con recuperación al máximo al presionar el nombre */}
              <div className="flex items-center justify-between py-0.5 px-1">
                <button
                  type="button"
                  onClick={restoreHpToMax}
                  className="flex items-center space-x-1 font-mono font-bold text-xs text-liminal-accent hover:text-red-300 group focus:outline-none"
                  title="Clic para restaurar HP al máximo"
                >
                  <span>HP</span>
                  <RotateCcw size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>

                <div className="flex items-center space-x-1 font-mono text-xs">
                  <input
                    type="number"
                    min={0}
                    max={character.hp.max}
                    value={character.hp.current}
                    onChange={(e) => updateHP('current', parseInt(e.target.value))}
                    className="w-8 text-center bg-black/40 rounded border border-gray-700 py-0.5 font-bold text-white focus:border-liminal-accent focus:outline-none"
                    title="HP Actual (≤ Máximo)"
                  />
                  <span className="text-gray-600">/</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={character.hp.max}
                    onChange={(e) => updateHP('max', parseInt(e.target.value))}
                    className="w-8 text-center bg-black/40 rounded border border-gray-700 py-0.5 text-gray-400 focus:border-liminal-accent focus:outline-none"
                    title="HP Máximo (≤ 10)"
                  />
                </div>
              </div>

              {/* Armadura (Nombre completo, máx 4) */}
              <div className="flex items-center justify-between py-0.5 px-1">
                <span className="font-mono font-bold text-xs text-blue-400">Armadura</span>
                <input
                  type="number"
                  min={0}
                  max={4}
                  value={character.armor}
                  onChange={(e) => updateArmor(parseInt(e.target.value))}
                  className="w-12 text-center bg-black/40 rounded border border-gray-700 py-0.5 font-bold font-mono text-white focus:border-liminal-accent focus:outline-none"
                  title="Armadura (0 a 4)"
                />
              </div>

              {/* Estabilidad (Nombre completo, máx 3) */}
              <div className="flex items-center justify-between py-0.5 px-1">
                <span className="font-mono font-bold text-xs text-purple-400">Estabilidad</span>
                <input
                  type="number"
                  min={0}
                  max={3}
                  value={character.stability}
                  onChange={(e) => updateStability(parseInt(e.target.value))}
                  className="w-12 text-center bg-black/40 rounded border border-gray-700 py-0.5 font-bold font-mono text-white focus:border-liminal-accent focus:outline-none"
                  title="Estabilidad (0 a 3)"
                />
              </div>
            </div>
          </div>

          {/* Mitad inferior: INVENTARIO con contador (x/10) */}
          <div className="flex-1 flex flex-col p-2.5 overflow-hidden">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center space-x-1.5">
                <span className="text-[10px] font-mono font-bold text-gray-300 uppercase tracking-wider">
                  INVENTARIO ({occupiedSlotsCount}/10)
                </span>
                <span className="text-[9px] text-gray-500 font-mono">
                  [Ítems · Heridas · Secuelas]
                </span>
              </div>

              <button
                onClick={addQuickItem}
                className="flex items-center space-x-1 px-1.5 py-0.5 bg-liminal-card hover:bg-liminal-border text-gray-300 hover:text-white rounded border border-gray-700 text-[10px] font-mono transition-colors"
                title="Añadir en el primer espacio vacío"
              >
                <Plus size={11} />
                <span>Ítem</span>
              </button>
            </div>

            {/* Lista compacta de los 10 slots */}
            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {character.inventory.map((slot, index) => {
                const isFatigue = !!slot?.isFatigue;

                return (
                  <div
                    key={index}
                    className={`flex items-center px-2 py-1 rounded border transition-colors ${
                      isFatigue
                        ? 'bg-red-950/30 border-red-900/60 text-red-200'
                        : slot?.name
                        ? 'bg-liminal-card border-liminal-border text-gray-100'
                        : 'bg-black/20 border-dashed border-gray-800/80 text-gray-500'
                    }`}
                  >
                    <span className="font-mono text-[10px] text-gray-500 w-4 select-none">
                      {index + 1}.
                    </span>

                    <input
                      type="text"
                      value={slot?.name || ''}
                      onChange={(e) => updateSlotText(index, e.target.value)}
                      placeholder="Vacío (objeto, herida o secuela)..."
                      className={`flex-1 bg-transparent text-xs px-1 focus:outline-none font-sans ${
                        isFatigue
                          ? 'text-red-300 font-medium placeholder-red-800/50'
                          : 'text-gray-100 placeholder-gray-700'
                      }`}
                    />

                    <div className="flex items-center space-x-1 ml-1 select-none">
                      <button
                        onClick={() => toggleFatigue(index)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-colors ${
                          isFatigue
                            ? 'bg-liminal-accent text-white shadow-sm'
                            : 'bg-black/40 text-gray-500 hover:text-red-300 hover:bg-red-950/40 border border-gray-800'
                        }`}
                        title={isFatigue ? 'Quitar Fatiga' : 'Marcar como Fatiga'}
                      >
                        FATIGA
                      </button>

                      {(slot?.name || isFatigue) && (
                        <button
                          onClick={() => clearSlot(index)}
                          className="p-0.5 text-gray-500 hover:text-red-400 transition-colors"
                          title="Limpiar casilla"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
