import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AdminPost } from '../api/client';
import { AdminApiError, adminApi } from '../api/client';
import { useAdminAuth } from '../auth/auth-context';

const excerpt = (content: string) => (content.length > 150 ? `${content.slice(0, 150)}…` : content);
const translationStatus = (post: AdminPost) => {
  const locales = new Set(post.translations?.map((translation) => translation.locale));
  return `${locales.has('en-IN') ? '✓' : '○'} English · ${locales.has('hi-IN') ? '✓' : '○'} Hindi`;
};
export const PostsPage = () => {
  const { logout } = useAdminAuth();
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setPosts(
        (await adminApi.listPosts({ status: status || undefined, source: source || undefined }))
          .items,
      );
    } catch (reason) {
      if (reason instanceof AdminApiError && reason.status === 401) {
        await logout();
        return;
      }
      setError(reason instanceof Error ? reason.message : 'Could not load posts');
    } finally {
      setLoading(false);
    }
  }, [logout, source, status]);
  useEffect(() => {
    void load();
  }, [load]);
  const transition = async (
    post: AdminPost,
    action: 'publish' | 'archive' | 'restore' | 'remove',
  ) => {
    const label = action === 'remove' ? 'remove' : action;
    if (!window.confirm(`Are you sure you want to ${label} this post?`)) return;
    try {
      await adminApi.transition(post.id, action);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Action failed');
    }
  };
  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Editorial workspace</p>
          <h1>Posts</h1>
          <p className="muted">Review, translate, and publish agricultural updates.</p>
        </div>
        <div className="heading-actions">
          <button className="secondary" onClick={logout}>
            Sign out
          </button>
          <Link className="primary button-link" to="/posts/new">
            New BlogPost
          </Link>
        </div>
      </div>
      <div className="filters panel">
        <label>
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
            <option value="REMOVED">Removed</option>
          </select>
        </label>
        <label>
          Source
          <select value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="">All sources</option>
            <option value="MANUAL">Manual</option>
            <option value="WEBSITE">Website</option>
            <option value="WHATSAPP">WhatsApp</option>
          </select>
        </label>
        <button className="secondary" onClick={() => void load()}>
          Refresh
        </button>
      </div>
      {error ? (
        <div className="alert error" role="alert">
          {error}
        </div>
      ) : null}
      {loading ? (
        <div className="loading">Loading posts…</div>
      ) : !posts.length ? (
        <div className="panel empty">
          <h2>No posts found</h2>
          <p>Create a draft or change the filters.</p>
        </div>
      ) : (
        <div className="post-table panel">
          <div className="table-head">
            <span>Post</span>
            <span>Status</span>
            <span>Translations</span>
            <span>Actions</span>
          </div>
          {posts.map((post) => (
            <article className="table-row" key={post.id}>
              <div className="post-summary">
                {post.image?.url ? (
                  <img src={post.image.url} alt="" />
                ) : (
                  <div className="thumb-placeholder">🌾</div>
                )}
                <div>
                  <Link to={`/posts/${post.id}/edit`}>
                    <strong>{post.title}</strong>
                  </Link>
                  <p>{excerpt(post.content)}</p>
                  <small>
                    {post.source} · {new Date(post.createdAt).toLocaleString()}
                  </small>
                  {post.externalRedirectUrl ? (
                    <a href={post.externalRedirectUrl} target="_blank" rel="noreferrer">
                      Source URL ↗
                    </a>
                  ) : null}
                </div>
              </div>
              <span className={`badge badge-${post.status.toLowerCase()}`}>{post.status}</span>
              <span className="muted">{translationStatus(post)}</span>
              <div className="row-actions">
                <Link to={`/posts/${post.id}/edit`}>Edit</Link>
                {post.status === 'DRAFT' ? (
                  <button onClick={() => void transition(post, 'publish')}>Publish</button>
                ) : null}
                {post.status === 'PUBLISHED' ? (
                  <button onClick={() => void transition(post, 'archive')}>Archive</button>
                ) : null}
                {post.status === 'ARCHIVED' || post.status === 'REMOVED' ? (
                  <button onClick={() => void transition(post, 'restore')}>Restore</button>
                ) : null}
                {post.status !== 'REMOVED' ? (
                  <button className="danger-link" onClick={() => void transition(post, 'remove')}>
                    Remove
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
