import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type {
  SyncCategoryStatusDto,
  SyncSourceStatusDto,
  SyncSourcesResponseDto,
} from '@virtual-mandi/shared';
import { AdminApiError, adminApi } from '../api/client';
import { useAdminAuth } from '../auth/auth-context';

const SNACKBAR_HIDE_MS = 3000;

type Snackbar = { message: string; kind: 'success' | 'error' };

const emptySourceForm = { domain: '', label: '', adapterKey: '' };
const emptyCategoryForm = {
  syncSourceId: '',
  label: '',
  listingUrl: '',
  categoryId: '',
  locationId: '',
  adapterConfig: '',
};

export const SyncPage = () => {
  const { logout } = useAdminAuth();
  const [overview, setOverview] = useState<SyncSourcesResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState<Snackbar | null>(null);
  const [sourceForm, setSourceForm] = useState(emptySourceForm);
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
  const [saving, setSaving] = useState<'source' | 'category' | null>(null);
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
        setOverview(await adminApi.listSyncSources());
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

  const fail = (prefix: string, reason: unknown) =>
    showSnackbar({
      message: `${prefix}: ${reason instanceof Error ? reason.message : 'Request failed'}`,
      kind: 'error',
    });

  const submitSource = async (event: FormEvent) => {
    event.preventDefault();
    setSaving('source');
    try {
      await adminApi.createSyncSource(sourceForm);
      setSourceForm(emptySourceForm);
      showSnackbar({ message: 'Sync source created', kind: 'success' });
      await load(true);
    } catch (reason) {
      fail('Could not create source', reason);
    } finally {
      setSaving(null);
    }
  };

  const submitCategory = async (event: FormEvent) => {
    event.preventDefault();
    let adapterConfig: Record<string, unknown> | undefined;
    if (categoryForm.adapterConfig.trim()) {
      try {
        adapterConfig = JSON.parse(categoryForm.adapterConfig) as Record<string, unknown>;
      } catch {
        showSnackbar({ message: 'Adapter config must be a JSON object', kind: 'error' });
        return;
      }
    }
    setSaving('category');
    try {
      await adminApi.createSyncCategory({
        syncSourceId: categoryForm.syncSourceId,
        label: categoryForm.label,
        listingUrl: categoryForm.listingUrl,
        categoryId: categoryForm.categoryId || undefined,
        locationId: categoryForm.locationId || undefined,
        adapterConfig,
      });
      setCategoryForm(emptyCategoryForm);
      showSnackbar({ message: 'Sync category created', kind: 'success' });
      await load(true);
    } catch (reason) {
      fail('Could not create category', reason);
    } finally {
      setSaving(null);
    }
  };

  const sync = async (source: SyncSourceStatusDto, category: SyncCategoryStatusDto) => {
    setSyncing((current) => new Set(current).add(category.id));
    try {
      const result = await adminApi.syncCategory(category.id);
      const parts = [`${result.created} new post${result.created === 1 ? '' : 's'} created`];
      if (result.duplicate) parts.push(`${result.duplicate} already up to date`);
      if (result.rejected) parts.push(`${result.rejected} rejected`);
      showSnackbar({
        message: `${source.label} — ${category.label}: ${parts.join(' · ')}`,
        kind: 'success',
      });
    } catch (reason) {
      if (reason instanceof AdminApiError && reason.status === 401) {
        await logout();
        return;
      }
      fail(`${source.label} — ${category.label}`, reason);
    } finally {
      setSyncing((current) => {
        const next = new Set(current);
        next.delete(category.id);
        return next;
      });
      void load(true);
    }
  };

  const sources = overview?.items ?? [];
  const noSources = sources.length === 0;

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Ingestion</p>
          <h1>Content sync</h1>
          <p className="muted">
            Fetch the latest posts from each listing URL. Useful when the scheduled job misses a
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
      <details className="panel sync-form">
        <summary>Add sync source</summary>
        <form className="form-grid" onSubmit={submitSource}>
          <label>
            Domain
            <input
              required
              placeholder="krishijagran.com"
              value={sourceForm.domain}
              onChange={(event) =>
                setSourceForm((current) => ({ ...current, domain: event.target.value }))
              }
            />
          </label>
          <label>
            Label
            <input
              required
              placeholder="Krishi Jagran"
              value={sourceForm.label}
              onChange={(event) =>
                setSourceForm((current) => ({ ...current, label: event.target.value }))
              }
            />
          </label>
          <label>
            Adapter
            <select
              required
              value={sourceForm.adapterKey}
              onChange={(event) =>
                setSourceForm((current) => ({ ...current, adapterKey: event.target.value }))
              }
            >
              <option value="">Select adapter…</option>
              {(overview?.adapters ?? []).map((adapter) => (
                <option key={adapter.key} value={adapter.key}>
                  {adapter.label}
                </option>
              ))}
            </select>
          </label>
          <div className="form-actions">
            <button className="primary" disabled={saving === 'source'}>
              {saving === 'source' ? 'Adding…' : 'Add source'}
            </button>
          </div>
        </form>
      </details>
      <details className="panel sync-form">
        <summary>Add category</summary>
        <form className="form-grid" onSubmit={submitCategory}>
          <label>
            Source
            <select
              required
              value={categoryForm.syncSourceId}
              onChange={(event) =>
                setCategoryForm((current) => ({ ...current, syncSourceId: event.target.value }))
              }
            >
              <option value="">Select source…</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.label} ({source.domain})
                </option>
              ))}
            </select>
          </label>
          <label>
            Label
            <input
              required
              placeholder="Commodity news"
              value={categoryForm.label}
              onChange={(event) =>
                setCategoryForm((current) => ({ ...current, label: event.target.value }))
              }
            />
          </label>
          <label>
            Listing URL
            <input
              required
              type="url"
              placeholder="https://krishijagran.com/commodity-news"
              value={categoryForm.listingUrl}
              onChange={(event) =>
                setCategoryForm((current) => ({ ...current, listingUrl: event.target.value }))
              }
            />
          </label>
          <label>
            Feed category
            <select
              value={categoryForm.categoryId}
              onChange={(event) =>
                setCategoryForm((current) => ({ ...current, categoryId: event.target.value }))
              }
            >
              <option value="">Adapter default</option>
              {(overview?.feedCategories ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Location
            <select
              value={categoryForm.locationId}
              onChange={(event) =>
                setCategoryForm((current) => ({ ...current, locationId: event.target.value }))
              }
            >
              <option value="">Adapter default</option>
              {(overview?.locations ?? []).map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Adapter config (JSON, optional)
            <input
              placeholder='{"categoryId": 14}'
              value={categoryForm.adapterConfig}
              onChange={(event) =>
                setCategoryForm((current) => ({ ...current, adapterConfig: event.target.value }))
              }
            />
          </label>
          <div className="form-actions">
            <button className="primary" disabled={saving === 'category' || noSources}>
              {saving === 'category' ? 'Adding…' : 'Add category'}
            </button>
          </div>
        </form>
      </details>
      {loading ? (
        <div className="loading">Loading sync sources…</div>
      ) : (
        <div className="sync-table panel">
          <div className="table-head">
            <span>Listing</span>
            <span>Posts</span>
            <span>Last fetched</span>
            <span>Action</span>
          </div>
          {noSources ? (
            <article className="table-row">
              <div>
                <strong>No sync sources yet</strong>
                <p className="muted">Add a sync source above, then add its listing URLs.</p>
              </div>
            </article>
          ) : (
            sources.map((source) =>
              source.categories.length === 0 ? (
                <article className="table-row" key={source.id}>
                  <div>
                    <strong>{source.label}</strong>
                    <p className="muted">{source.domain} — no categories yet</p>
                  </div>
                </article>
              ) : (
                source.categories.map((category) => (
                  <article className="table-row" key={category.id}>
                    <div>
                      <strong>
                        {source.label} — {category.label}
                      </strong>
                      <p className="muted">
                        {category.listingUrl}
                        {category.categoryName ? ` → ${category.categoryName}` : ''}
                      </p>
                    </div>
                    <span>{category.postCount}</span>
                    <span className="muted">
                      {category.lastFetchedAt
                        ? new Date(category.lastFetchedAt).toLocaleString()
                        : 'Never'}
                    </span>
                    <div className="row-actions">
                      {(() => {
                        const busy = syncing.has(category.id) || category.syncing;
                        return (
                          <button
                            className="primary"
                            disabled={busy}
                            onClick={() => void sync(source, category)}
                          >
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
                ))
              ),
            )
          )}
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
