import { useEffect, useState } from 'react';
import * as SQLite from 'expo-sqlite';
import { getDatabase } from '../db/database';

export function useDatabase() {
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    getDatabase()
      .then((database) => {
        if (mounted) {
          setDb(database);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err);
          setLoading(false);
        }
      });
    return () => { mounted = false; };
  }, []);

  return { db, loading, error };
}
