import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from './Alert.jsx';
import Card from './Card.jsx';
import EmptyState from './EmptyState.jsx';
import { resourceAPI } from '../services/api.js';

export default function LearningResourceSection({ topicId, onChange }) {
  const [resources, setResources] = useState([]);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => resourceAPI.list(topicId).then(({ data }) => setResources(data.data.resources)).catch((requestError) => setError(requestError.response?.data?.message || 'Unable to load learning resources'));
  useEffect(() => { load(); }, [topicId]);
  const add = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    try { await resourceAPI.addYoutube({ topicId: Number(topicId), url, title: title || undefined }); setUrl(''); setTitle(''); await load(); onChange?.(); } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to add YouTube resource'); } finally { setSaving(false); }
  };
  const remove = async (id) => { await resourceAPI.remove(id); await load(); onChange?.(); };
  return <section className="lynx-resource-section">
    <div className="lynx-row-between"><div><p className="lynx-eyebrow">Learning materials</p><h2 className="lynx-h2">Videos for this topic</h2></div><Link to="/materials" className="lynx-text-link">View all →</Link></div>
    <Card className="lynx-resource-add"><form onSubmit={add} className="lynx-form"><input required aria-label="YouTube video URL" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Paste a YouTube educational video URL" className="lynx-input" /><div className="lynx-inline-form"><input aria-label="Video title (optional)" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Optional title" className="lynx-input lynx-grow" /><button disabled={saving} className="lynx-btn lynx-btn-primary">{saving ? 'Adding...' : 'Add video'}</button></div><Alert>{error}</Alert></form></Card>
    {resources.length ? <div className="lynx-resource-list">{resources.map((resource) => <Card key={resource.id} className="lynx-resource-row"><div><h3 className="lynx-h3">{resource.title}</h3><p className="lynx-muted lynx-caption">{resource.metadata?.authorName || 'YouTube'} · {resource.completedAt ? 'Completed' : `${resource.watchedPercent}% watched`}</p></div><div className="lynx-resource-actions"><Link to={`/learn/youtube/${resource.id}`} className="lynx-btn lynx-btn-primary lynx-btn-sm">Learn</Link><button type="button" onClick={() => remove(resource.id)} className="lynx-link-btn">Delete</button></div></Card>)}</div> : <Card><EmptyState title="No videos added yet" description="Add a trusted educational YouTube video to study it alongside this topic." /></Card>}
  </section>;
}
