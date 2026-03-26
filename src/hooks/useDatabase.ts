import { useEffect, useState } from 'react';
import { Repository, getRepository } from '../db/repository';

let cachedRepo: Repository | null = null;
let repoPromise: Promise<Repository> | null = null;

export function useDatabase() {
  const [repo, setRepo] = useState<Repository | null>(cachedRepo);
  const [loading, setLoading] = useState(!cachedRepo);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (cachedRepo) {
      setRepo(cachedRepo);
      setLoading(false);
      return;
    }

    let mounted = true;
    if (!repoPromise) {
      repoPromise = getRepository();
    }

    repoPromise
      .then((r) => {
        cachedRepo = r;
        if (mounted) {
          setRepo(r);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('[useDatabase] Failed:', err);
        repoPromise = null;
        if (mounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      });

    return () => { mounted = false; };
  }, []);

  return { repo, loading, error };
}
