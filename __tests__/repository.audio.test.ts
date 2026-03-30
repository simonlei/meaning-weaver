/**
 * Tests for audio_uri support in repository layer:
 * - migration v4 adds audio_uri column
 * - insertFragment stores audio_uri
 * - deleteFragment cleans up audio file
 */

import { runMigrations, SQLiteRepository } from '../src/db/repository';

// expo-file-system is mocked via __mocks__/expo-file-system.js (already exists)
// expo-sqlite is mocked via __mocks__/expo-sqlite.js
const { openDatabaseAsync } = require('expo-sqlite');
const FileSystem = require('expo-file-system');

describe('SQLiteRepository – audio_uri support', () => {
  let db: any;
  let repo: SQLiteRepository;

  beforeEach(async () => {
    db = await openDatabaseAsync('test.db');
    await runMigrations(db);
    repo = new SQLiteRepository(db);
    // Clear any file system mock calls from previous tests
    jest.clearAllMocks();
  });

  describe('migration v4', () => {
    it('adds audio_uri column to fragments table', async () => {
      // Check the column exists via the mock's _columns tracking
      expect(db._columns['fragments'].has('audio_uri')).toBe(true);
    });

    it('is idempotent – running migrations again does not throw', async () => {
      await expect(runMigrations(db)).resolves.not.toThrow();
    });

    it('user_version is at least 4 after migrations', async () => {
      expect(db._user_version).toBeGreaterThanOrEqual(4);
    });
  });

  describe('insertFragment with audio_uri', () => {
    it('stores audio_uri when provided', async () => {
      const fragment = await repo.insertFragment(
        'Test voice content',
        undefined,
        undefined,
        'file:///audio/test.m4a'
      );
      expect(fragment.audio_uri).toBe('file:///audio/test.m4a');
    });

    it('stores null audio_uri when not provided', async () => {
      const fragment = await repo.insertFragment('Text only');
      expect(fragment.audio_uri).toBeNull();
    });

    it('stores audio_uri alongside photo_uri', async () => {
      const fragment = await repo.insertFragment(
        'With both',
        'file:///photos/test.jpg',
        undefined,
        'file:///audio/test.m4a'
      );
      expect(fragment.photo_uri).toBe('file:///photos/test.jpg');
      expect(fragment.audio_uri).toBe('file:///audio/test.m4a');
    });
  });

  describe('deleteFragment with audio_uri', () => {
    it('deletes audio file when fragment has audio_uri', async () => {
      const fragment = await repo.insertFragment(
        'Voice fragment',
        undefined,
        undefined,
        'file:///audio/voice.m4a'
      );

      // Manually insert into the mock DB table so SELECT works in deleteFragment
      db._tables['fragments'].forEach((row: any) => {
        if (row.id === fragment.id) {
          row.audio_uri = 'file:///audio/voice.m4a';
        }
      });

      await repo.deleteFragment(fragment.id);

      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        'file:///audio/voice.m4a',
        { idempotent: true }
      );
    });

    it('deletes both photo and audio files when both are present', async () => {
      const fragment = await repo.insertFragment(
        'Both media',
        'file:///mock/documents/photo.jpg',
        undefined,
        'file:///audio/audio.m4a'
      );

      // Update mock table to reflect stored uris
      db._tables['fragments'].forEach((row: any) => {
        if (row.id === fragment.id) {
          row.photo_uri = 'file:///mock/documents/photo.jpg';
          row.audio_uri = 'file:///audio/audio.m4a';
        }
      });

      await repo.deleteFragment(fragment.id);

      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        'file:///mock/documents/photo.jpg',
        { idempotent: true }
      );
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        'file:///audio/audio.m4a',
        { idempotent: true }
      );
    });

    it('does not throw when audio file is already missing', async () => {
      const fragment = await repo.insertFragment(
        'Voice fragment',
        undefined,
        undefined,
        'file:///audio/missing.m4a'
      );

      db._tables['fragments'].forEach((row: any) => {
        if (row.id === fragment.id) {
          row.audio_uri = 'file:///audio/missing.m4a';
        }
      });

      // Make FileSystem.deleteAsync throw to simulate missing file
      (FileSystem.deleteAsync as jest.Mock).mockRejectedValueOnce(
        new Error('File not found')
      );

      await expect(repo.deleteFragment(fragment.id)).resolves.not.toThrow();
    });

    it('removes fragment from DB even if file cleanup fails', async () => {
      const fragment = await repo.insertFragment(
        'Voice fragment',
        undefined,
        undefined,
        'file:///audio/will-fail.m4a'
      );

      db._tables['fragments'].forEach((row: any) => {
        if (row.id === fragment.id) {
          row.audio_uri = 'file:///audio/will-fail.m4a';
        }
      });

      (FileSystem.deleteAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Disk error')
      );

      await repo.deleteFragment(fragment.id);

      const remaining = db._tables['fragments'].filter((r: any) => r.id === fragment.id);
      expect(remaining).toHaveLength(0);
    });
  });
});
