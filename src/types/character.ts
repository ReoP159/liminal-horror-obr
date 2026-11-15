export interface AttributeValue {
  current: number;
  max: number;
}

export interface InventorySlot {
  id: string;
  name: string;
  isFatigue?: boolean;
  isBulky?: boolean;
}

export interface LiminalCharacter {
  id: string;
  playerId?: string;
  playerName?: string;
  name: string;
  concept: string;
  
  // Atributos base (Max <= 19, Current <= Max)
  attributes: {
    str: AttributeValue;
    dex: AttributeValue;
    ctrl: AttributeValue;
  };

  // Vitals (HP Max <= 10, Armor <= 4, Stability <= 3)
  hp: AttributeValue;
  armor: number;
  stability: number;

  // 10 casillas de inventario (incluyen objetos, heridas y secuelas)
  inventory: (InventorySlot | null)[];

  notes?: string;
}

export interface RollEvent {
  id: string;
  playerId: string;
  playerName: string;
  characterName: string;
  attrKey: 'str' | 'dex' | 'ctrl' | 'npc';
  attrName: string;
  attrValue: number;
  roll: number;
  isSuccess: boolean;
  timestamp: number;
}

export const DEFAULT_CHARACTER: LiminalCharacter = {
  id: 'default-char',
  name: 'Nuevo Investigador',
  concept: '',
  attributes: {
    str: { current: 10, max: 10 },
    dex: { current: 10, max: 10 },
    ctrl: { current: 10, max: 10 }
  },
  hp: { current: 4, max: 4 },
  armor: 0,
  stability: 0,
  inventory: Array.from({ length: 10 }, (_, i) => null),
  notes: ''
};
