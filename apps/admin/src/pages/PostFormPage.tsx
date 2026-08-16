import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { blogPostCreateSchema, blogPostUpdateSchema, type PostSource } from '@virtual-mandi/shared';
import { adminApi } from '../api/client';

const initial: {
  source: PostSource;
  externalRedirectUrl: string;
  imageMediaId: string;
  categoryIds: string;
  locationIds: string;
  enTitle: string;
  enContent: string;
  hiTitle: string;
  hiContent: string;
} = {
  source: 'MANUAL',
  externalRedirectUrl: '',
  imageMediaId: '',
  categoryIds: '',
  locationIds: '',
  enTitle: '',
  enContent: '',
  hiTitle: '',
  hiContent: '',
};
export const PostFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!id) return;
    adminApi
      .listPosts()
      .then(({ items }) => {
        const post = items.find((item) => item.id === id);
        if (!post) throw new Error('Post not found');
        const english = post.translations?.find((item) => item.locale === 'en-IN');
        const hindi = post.translations?.find((item) => item.locale === 'hi-IN');
        setForm({
          source: post.source,
          externalRedirectUrl: post.externalRedirectUrl ?? '',
          imageMediaId: post.image?.id ?? '',
          categoryIds: post.categoryIds.join(', '),
          locationIds: post.locationIds.join(', '),
          enTitle: english?.title ?? post.title,
          enContent: english?.content ?? post.content,
          hiTitle: hindi?.title ?? '',
          hiContent: hindi?.content ?? '',
        });
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load post'))
      .finally(() => setLoading(false));
  }, [id]);
  const update = (key: keyof typeof initial, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    const translations = [
      { locale: 'en-IN', title: form.enTitle, content: form.enContent },
      ...(form.hiTitle && form.hiContent
        ? [{ locale: 'hi-IN', title: form.hiTitle, content: form.hiContent }]
        : []),
    ];
    const input = {
      type: 'BLOG_POST' as const,
      source: form.source,
      externalRedirectUrl: form.externalRedirectUrl || undefined,
      imageMediaId: form.imageMediaId || undefined,
      categoryIds: form.categoryIds
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      locationIds: form.locationIds
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      translations,
    };
    try {
      if (id) {
        const parsed = blogPostUpdateSchema.parse(input);
        await adminApi.updatePost(id, parsed);
      } else {
        const parsed = blogPostCreateSchema.parse(input);
        await adminApi.createPost(parsed);
      }
      navigate('/posts');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save post');
    } finally {
      setSaving(false);
    }
  };
  if (loading) return <div className="loading">Loading post…</div>;
  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Editorial</p>
          <h1>{id ? 'Edit BlogPost' : 'New BlogPost'}</h1>
        </div>
        <button className="secondary" onClick={() => navigate('/posts')}>
          Cancel
        </button>
      </div>
      <form className="panel form-grid" onSubmit={submit}>
        <label>
          Source
          <select value={form.source} onChange={(event) => update('source', event.target.value)}>
            <option value="MANUAL">Manual</option>
            <option value="WEBSITE">Website</option>
            <option value="WHATSAPP">WhatsApp</option>
          </select>
        </label>
        <label>
          External redirect URL
          <input
            type="url"
            placeholder="https://example.com/story"
            value={form.externalRedirectUrl}
            onChange={(event) => update('externalRedirectUrl', event.target.value)}
          />
        </label>
        <label>
          Image media ID
          <input
            placeholder="MediaAsset ID from upload flow"
            value={form.imageMediaId}
            onChange={(event) => update('imageMediaId', event.target.value)}
          />
        </label>
        <label>
          Category IDs
          <input
            placeholder="Comma-separated IDs"
            value={form.categoryIds}
            onChange={(event) => update('categoryIds', event.target.value)}
          />
        </label>
        <label>
          Location IDs
          <input
            placeholder="Comma-separated IDs"
            value={form.locationIds}
            onChange={(event) => update('locationIds', event.target.value)}
          />
        </label>
        <fieldset>
          <legend>English (required for publishing)</legend>
          <label>
            Title
            <input
              required
              value={form.enTitle}
              onChange={(event) => update('enTitle', event.target.value)}
            />
          </label>
          <label>
            Content
            <textarea
              required
              rows={8}
              value={form.enContent}
              onChange={(event) => update('enContent', event.target.value)}
            />
          </label>
        </fieldset>
        <fieldset>
          <legend>Hindi (optional; English fallback applies)</legend>
          <label>
            Title
            <input
              value={form.hiTitle}
              onChange={(event) => update('hiTitle', event.target.value)}
            />
          </label>
          <label>
            Content
            <textarea
              rows={8}
              value={form.hiContent}
              onChange={(event) => update('hiContent', event.target.value)}
            />
          </label>
        </fieldset>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="form-actions">
          <button className="primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save draft'}
          </button>
        </div>
      </form>
    </section>
  );
};
