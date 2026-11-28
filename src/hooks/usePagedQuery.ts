import { useCallback, useEffect, useState } from 'react';
import { readData, type Filter } from '@/repositories/db';

export function usePagedQuery<T>(kind: 'products' | 'history', filter: Filter, size = 50, revision = 0) {
  const key = JSON.stringify(filter);
  const [cursor, setCursor] = useState({ key, page: 1 });
  const page = cursor.key === key ? cursor.page : 1;
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState({ rows: [] as T[], total: 0, error: '', request: '' });
  const request = JSON.stringify([kind, key, page, size, revision, version]);
  const setPage = useCallback((n: number) => setCursor({ key, page: Math.max(1, n) }), [key, setCursor]);
  const refresh = useCallback(() => setVersion(n => n + 1), [setVersion]);
  useEffect(() => {
    let current = true;
    const args: Filter = JSON.parse(key);
    Promise.all([
      readData<T>(kind, { ...args, offset: (page - 1) * size, limit: size }),
      readData<{ count: number }>(kind + '_count', args),
    ]).then(([rows, [count]]) => {
      if (!current) return;
      const last = Math.max(1, Math.ceil(count.count / size));
      if (page > last) setPage(last);
      else setResult({ rows, total: count.count, error: '', request });
    }).catch(e => {
      if (current) setResult({ rows: [], total: 0, error: String(e), request });
    });
    return () => { current = false; };
  }, [kind, key, page, size, request, setPage]);
  const loading = result.request !== request;
  return { rows: loading ? [] : result.rows, total: result.total, error: loading ? '' : result.error, loading, page, size, setPage, refresh };
}
