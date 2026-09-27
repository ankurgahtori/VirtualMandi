import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { IngestionSourceStatusDto } from '@virtual-mandi/shared';
import { AdminApiError, adminApi } from '../api/client';
import { useAdminAuth } from '../auth/auth-context';

const SNACKBAR_HIDE_MS = 3000;

type Snackbar = { message: string; kind: 'success' | 'error' };

export const SyncPage = () => {
  const { logout } = useAdminAuth();
  const [sources, setSources] = useState<IngestionSourceStatusDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState<Snackbar | null>(null);
  const snackbarTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showSnackbar = useCallback((next: Snackbar) => {
    setSnackbar(next);
    clearTimeout(snackbarTimer.current);
    snackbarTimer.current = setTimeout(() => setSnackbar(null), SNACKBAR_HIDE_MS);
  }, []);

  useEffect(() => () => clearTimeout(snackbarTimer.current), []);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError('');
      try {
        setSources((await adminApi.listSyncSources()).items);
      } catch (reason) {
        if (reason instanceof AdminApiError && reason.status === 401) {
          await logout();
          return;
        }
        setError(reason instanceof Error ? reason.message : 'Could not load sync sources');
      } finally {
        setLoading(false);
      }
    },
    [logout],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const sync = async (source: IngestionSourceStatusDto) => {
    setSyncing((current) => new Set(current).add(source.domain));
    try {
      const result = await adminApi.syncSource(source.domain);
      const parts = [`${result.created} new post${result.created === 1 ? '' : 's'} created`];
      if (result.duplicate) parts.push(`${result.duplicate} already up to date`);
      if (result.rejected) parts.push(`${result.rejected} rejected`);
      showSnackbar({ message: `${source.label}: ${parts.join(' · ')}`, kind: 'success' });
    } catch (reason) {
      if (reason instanceof AdminApiError && reason.status === 401) {
        await logout();
        return;
      }
      showSnackbar({
        message: `${source.label}: ${reason instanceof Error ? reason.message : 'Sync failed'}`,
        kind: 'error',
      });
    } finally {
      setSyncing((current) => {
        const next = new Set(current);
        next.delete(source.domain);
        return next;
      });
      void load(true);
    }
  };

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Ingestion</p>
          <h1>Content sync</h1>
          <p className="muted">
            Fetch the latest posts from each crawled website. Useful when the scheduled job misses a
            run.
          </p>
        </div>
        <div className="heading-actions">
          <button className="secondary" onClick={logout}>
            Sign out
          </button>
          <Link className="secondary button-link" to="/posts">
            Posts
          </Link>
        </div>
      </div>
      {error ? (
        <div className="alert error" role="alert">
          {error}
        </div>
      ) : null}
      {loading ? (
        <div className="loading">Loading sync sources…</div>
      ) : (
        <div className="sync-table panel">
          <div className="table-head">
            <span>Source</span>
            <span>Posts</span>
            <span>Last fetched</span>
            <span>Action</span>
          </div>
          {sources.map((source) => (
            <article className="table-row" key={source.domain}>
              <div>
                <strong>{source.label}</strong>
                <p className="muted">{source.domain}</p>
              </div>
              <span>{source.postCount}</span>
              <span className="muted">
                {source.lastFetchedAt ? new Date(source.lastFetchedAt).toLocaleString() : 'Never'}
              </span>
              <div className="row-actions">
                {(() => {
                  const busy = syncing.has(source.domain) || source.syncing;
                  return (
                    <button className="primary" disabled={busy} onClick={() => void sync(source)}>
                      {busy ? (
                        <>
                          <span className="spinner" aria-hidden="true" /> Syncing…
                        </>
                      ) : (
                        'Sync'
                      )}
                    </button>
                  );
                })()}
              </div>
            </article>
          ))}
        </div>
      )}
      {snackbar ? (
        <div className={`snackbar ${snackbar.kind === 'error' ? 'error' : ''}`} role="status">
          {snackbar.message}
        </div>
      ) : null}
    </section>
  );
};
