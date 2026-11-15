import OBR from '@owlbear-rodeo/sdk';
import { LiminalCharacter, RollEvent } from '../types/character';

export const METADATA_KEY = 'com.liminal-horror.sheet/room-characters';
export const BROADCAST_DICE_ROLL = 'com.liminal-horror.sheet/dice-roll';
export const BROADCAST_CHAR_SYNC = 'com.liminal-horror.sheet/char-sync';
const LOCAL_STORAGE_KEY = 'liminal_horror_standalone_chars';

export interface OBRState {
  isReady: boolean;
  role: 'GM' | 'PLAYER';
  playerId: string;
  playerName: string;
}

/**
 * Inicializa la conexión con Owlbear Rodeo a nivel de Sala (Room Metadata) y Canales Broadcast
 */
export function initOBR(
  onStateChange: (state: OBRState) => void,
  onCharactersChange: (chars: Record<string, LiminalCharacter>) => void,
  onDiceRollReceived: (roll: RollEvent) => void
) {
  const isInsideIframe = window.self !== window.top;

  if (!isInsideIframe) {
    console.warn('Owlbear Rodeo: Modo standalone (desarrollo local). Usando LocalStorage.');
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    const chars = stored ? JSON.parse(stored) : {};

    onStateChange({
      isReady: false,
      role: 'GM', // En standalone permitimos ver ambas vistas
      playerId: 'local-player',
      playerName: 'Investigador Local'
    });
    onCharactersChange(chars);
    return;
  }

  OBR.onReady(async () => {
    const role = (await OBR.player.getRole()) === 'GM' ? 'GM' : 'PLAYER';
    const playerId = await OBR.player.getId();
    const playerName = (await OBR.player.getName()) || 'Jugador';

    onStateChange({
      isReady: true,
      role,
      playerId,
      playerName
    });

    // 1. Cargar personajes existentes desde los metadatos de la sala
    const metadata = await OBR.room.getMetadata();
    const roomChars = (metadata[METADATA_KEY] as Record<string, LiminalCharacter>) || {};
    onCharactersChange(roomChars);

    // 2. Escuchar cambios de metadatos persistentes de la sala
    OBR.room.onMetadataChange((meta) => {
      const updatedChars = (meta[METADATA_KEY] as Record<string, LiminalCharacter>) || {};
      onCharactersChange(updatedChars);
    });

    // 3. Escuchar canal de broadcast de sincronización rápida de personajes
    OBR.broadcast.onMessage(BROADCAST_CHAR_SYNC, (event) => {
      const data = event.data as { playerId: string; character: LiminalCharacter };
      if (data && data.playerId && data.character) {
        onCharactersChange({ [data.playerId]: data.character });
      }
    });

    // 4. Escuchar canal de broadcast de tiradas de dados en tiempo real
    OBR.broadcast.onMessage(BROADCAST_DICE_ROLL, (event) => {
      const roll = event.data as RollEvent;
      if (roll) {
        onDiceRollReceived(roll);
      }
    });
  });
}

/**
 * Guarda o actualiza la ficha del jugador en los metadatos de la sala y emite broadcast en tiempo real
 */
export async function savePlayerCharacter(
  playerId: string,
  character: LiminalCharacter
): Promise<boolean> {
  const isInsideIframe = window.self !== window.top;

  if (!isInsideIframe || !OBR.isReady) {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      const chars = stored ? JSON.parse(stored) : {};
      chars[playerId] = character;
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(chars));
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  try {
    // 1. Transmitir inmediatamente vía broadcast a toda la mesa (cero latencia para el GM)
    await OBR.broadcast.sendMessage(BROADCAST_CHAR_SYNC, {
      playerId,
      character
    });

    // 2. Guardar persistentemente en los metadatos de la sala
    const metadata = await OBR.room.getMetadata();
    const existing = (metadata[METADATA_KEY] as Record<string, LiminalCharacter>) || {};

    await OBR.room.setMetadata({
      [METADATA_KEY]: {
        ...existing,
        [playerId]: character
      }
    });

    return true;
  } catch (error) {
    console.error('Error al guardar en la sala de OBR:', error);
    return false;
  }
}

/**
 * Emite una tirada de dados en tiempo real a todos los jugadores conectados en la sala
 */
export async function broadcastDiceRoll(roll: RollEvent) {
  if (OBR.isReady) {
    // Enviar a todos los jugadores de la sala
    await OBR.broadcast.sendMessage(BROADCAST_DICE_ROLL, roll);

    // Notificación nativa de OBR en el tablero para quienes tengan el popover cerrado
    const verdict = roll.isSuccess ? 'ÉXITO' : 'FALLO';
    const msg = `${roll.characterName} (${roll.attrName}): [${roll.roll} vs ${roll.attrValue}] -> ${verdict}`;
    await OBR.notification.show(msg, roll.isSuccess ? 'SUCCESS' : 'ERROR');
  }
}

/**
 * Muestra una notificación en Owlbear Rodeo
 */
export async function notifyOBR(
  message: string,
  variant: 'DEFAULT' | 'SUCCESS' | 'WARNING' | 'ERROR' = 'DEFAULT'
) {
  if (OBR.isReady) {
    await OBR.notification.show(message, variant);
  } else {
    console.log(`[Notificación OBR - ${variant}]: ${message}`);
  }
}
