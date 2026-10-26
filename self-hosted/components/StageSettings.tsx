import { useState } from 'react';
import { action, type Stage } from '../lib/client';
export function StageSettings({ stages, refresh }: { stages: Stage[]; refresh: () => Promise<void> }) {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function run(name: string, values: Record<string, unknown>) { setBusy(true); setError(''); try { await action(name, values); await refresh(); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }
  return <section><h2>Access stages</h2><p className="muted">A room can read selected documents at its stage and every earlier stage. Changing this order changes access immediately.</p>
    <ol className="stage-list">{stages.map((stage, index) => <li key={stage.id}><form onSubmit={e => { e.preventDefault(); run('renameStage', { stageId: stage.id, name: new FormData(e.currentTarget).get('name') }); }}>
      <input aria-label={`Stage ${index + 1} name`} name="name" defaultValue={stage.name} key={stage.name} required maxLength={80} /><button className="quiet" disabled={busy}>Save name</button>
      <button type="button" className="quiet" disabled={busy || index === 0} onClick={() => { const ids = stages.map(s => s.id); [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]]; run('reorderStages', { stageIds: ids }); }}>Move earlier</button>
    </form></li>)}</ol>
    <form className="inline" onSubmit={async e => { e.preventDefault(); const form = e.currentTarget; await run('createStage', { name: new FormData(form).get('name') }); form.reset(); }}><label>New stage<input name="name" required maxLength={80} placeholder="e.g. Due diligence" /></label><button disabled={busy}>Add stage</button></form>
    {error && <p role="alert" className="error">{error}</p>}
  </section>;
}
