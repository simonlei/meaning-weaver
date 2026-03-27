/**
 * AudioPlayerContext — global singleton audio player management.
 *
 * Ensures only one audio clip plays at a time across all FragmentItems.
 * When a new fragment's audio starts playing, the previously-playing one is stopped.
 */
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

type AudioPlayerContextValue = {
  /** ID of the currently-playing fragment (or null) */
  playingId: string | null;
  /** Set which fragment is "playing" — stops the previous one */
  setPlayingId: (id: string | null) => void;
  /** Request to stop the currently playing audio (from any player) */
  stopCurrent: () => void;
  /** Register a stop callback for a fragment; called when another fragment starts */
  registerStopCallback: (id: string, cb: () => void) => void;
  /** Unregister a stop callback when a fragment unmounts */
  unregisterStopCallback: (id: string) => void;
};

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const [playingId, setPlayingIdState] = useState<string | null>(null);
  const stopCallbacks = useRef<Map<string, () => void>>(new Map());

  const setPlayingId = useCallback((id: string | null) => {
    setPlayingIdState((prev) => {
      // Stop the previously playing fragment (if any, and if different)
      if (prev && prev !== id) {
        const stopFn = stopCallbacks.current.get(prev);
        stopFn?.();
      }
      return id;
    });
  }, []);

  const stopCurrent = useCallback(() => {
    setPlayingIdState((prev) => {
      if (prev) {
        const stopFn = stopCallbacks.current.get(prev);
        stopFn?.();
      }
      return null;
    });
  }, []);

  const registerStopCallback = useCallback((id: string, cb: () => void) => {
    stopCallbacks.current.set(id, cb);
  }, []);

  const unregisterStopCallback = useCallback((id: string) => {
    stopCallbacks.current.delete(id);
  }, []);

  return (
    <AudioPlayerContext.Provider
      value={{ playingId, setPlayingId, stopCurrent, registerStopCallback, unregisterStopCallback }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayerContext(): AudioPlayerContextValue {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) throw new Error('useAudioPlayerContext must be used inside AudioPlayerProvider');
  return ctx;
}
