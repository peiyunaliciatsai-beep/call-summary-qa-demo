const $ = (s) => document.querySelector(s);
const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY = 'soundsense-review-v1';
const labels = {unreviewed:'Not reviewed', acceptable:'Acceptable', correction:'Needs correction', uncertain:'Uncertain'};
const categories = ['Contradiction', 'Unsupported claim', 'Required omission', 'Rule breach'];
let calls = [], reviews = {}, activeId, selected = new Set(), storageAvailable = true, savedDataInvalid = false;
function notice(message) { $('#notice').textContent = message; }
function persist() {
  if (savedDataInvalid) { notice('Existing saved data could not be read and has been preserved. New changes are in memory only: export them before closing this tab.'); return; }
  try { localStorage.setItem(KEY, JSON.stringify({version:1,reviews})); if (!storageAvailable) notice('Browser saving is available again.'); storageAvailable = true; }
  catch { storageAvailable = false; notice('Browser saving is unavailable. Keep this tab open and export your reviews to avoid losing work.'); }
}
function emptyDraft() { return {category:'', certainty:'Uncertain', text:'', turns:[], quote:'', start:null, end:null}; }
function review(id = activeId) {
 const r = reviews[id] ||= {decision:'',completed:false,findings:[],corrected:'',notes:'',draft:emptyDraft()};
 r.pending ||= []; r.draft.quote ||= ''; return r;
}
function hasDraft(d) { return Boolean(d.editingId || d.text?.trim() || d.quote || d.turns?.length); }
function syncFindingVisibility() { const r=review(); $('#finding-form').hidden=!hasDraft(r.draft); $('#findings-panel').hidden=!(r.findings.length || r.pending.length || hasDraft(r.draft)); }
function feedback(target, message, error = true) {
 const box = $(target); box.textContent = message; box.classList.toggle('error', error);
 if (error) box.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function newId() { return globalThis.crypto?.randomUUID?.() || `finding-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function summaryMarkup(call) {
 const r = review(), ranges = [...r.findings,...r.pending,r.draft].filter(f => f.quote && Number.isInteger(f.start) && call.summary.slice(f.start,f.end)===f.quote).map(f=>[f.start,f.end]).sort((a,b)=>a[0]-b[0]);
 const merged=[]; for (const range of ranges) { const last=merged.at(-1); if(last && range[0]<=last[1])last[1]=Math.max(last[1],range[1]);else merged.push([...range]); }
 let cursor=0,html=''; for(const [start,end] of merged){html+=esc(call.summary.slice(cursor,start))+`<mark>${esc(call.summary.slice(start,end))}</mark>`;cursor=end;}return html+esc(call.summary.slice(cursor));
}
function renderSummary() { const call=calls.find(c=>c.id===activeId); $('#summary-text').innerHTML=summaryMarkup(call); }
function captureHighlight() {
 if(review().completed)return;
 const selection=window.getSelection(); if(!selection || selection.isCollapsed || !selection.rangeCount)return;
 const range=selection.getRangeAt(0), summary=$('#summary-text');
 if(!summary.contains(range.startContainer)||!summary.contains(range.endContainer))return;
 const quote=range.toString(); if(!quote.trim())return;
 const before=range.cloneRange();before.selectNodeContents(summary);before.setEnd(range.startContainer,range.startOffset);
 const start=before.toString().length,r=review();
 if(r.draft.quote===quote && r.draft.start===start)return;
 if(hasDraft(r.draft))r.pending.push({...r.draft,turns:[...r.draft.turns]});
 r.draft={...emptyDraft(),quote,start,end:start+quote.length};selected.clear();selection.removeAllRanges();
 markDraft();loadDraft();renderSummary();feedback('#finding-feedback','Quote captured. Add a note and link turns.',false);
}
function renderPending() {
 const r=review(); $('#pending-drafts').innerHTML=r.pending.map((d,i)=>`<button type="button" data-draft="${i}" class="pending-draft"><strong>Draft ${i+1}</strong> ${esc(d.quote || d.text || 'Evidence selected')}</button>`).join('');
}
function loadDraft() {
 const d=review().draft;selected=new Set(d.turns);$('#category').value=d.category;$('#certainty').value=d.certainty;$('#finding-text').value=d.text;
 $('#finding-editor-title').textContent=d.editingId?'Edit finding':'New finding';$('#save-finding').textContent=d.editingId?'Save changes':'Add finding';$('#discard-draft').textContent=d.editingId?'Cancel edit':'Discard draft';$('#finding-feedback').textContent='';$('#draft-quote').textContent=d.quote;$('#draft-quote').hidden=!d.quote;renderPending();updateSelection();syncFindingVisibility();
}

function status(id) { const r = review(id); return r.completed ? r.decision : 'unreviewed'; }
function turns(call) { return call.transcript.split('\n').filter(Boolean).map(line => { const m = line.match(/^(T\d+) \[([^\]]+)\] ([^:]+):\s*(.*)$/); return m ? {id:m[1],time:m[2],speaker:m[3],text:m[4]} : {id:'',time:'',speaker:'Transcript note',text:line}; }); }
function markDraft() { review().completed = false; persist(); renderQueue(); $('#review-state').textContent = storageAvailable && !savedDataInvalid ? 'Draft · saved in browser' : 'Draft · export to keep'; }
function renderQueue() {
 const search = $('#search').value.trim().toLowerCase(), filter = $('#filter').value;
 const filtered = calls.filter(c => (filter === 'all' || status(c.id) === filter) && `${c.id} ${c.summary} ${c.transcript}`.toLowerCase().includes(search));
 $('#call-list').innerHTML = filtered.map(c => `<button class="call-item ${c.id===activeId?'active':''}" data-call="${c.id}" ${c.id===activeId?'aria-current="true"':''}><span><strong>${c.id}</strong><small>${labels[status(c.id)]}</small></span><span aria-hidden="true" class="status-dot ${status(c.id)}"></span></button>`).join('') || '<p class="empty">No calls match your filters.</p>';
 const count = calls.filter(c=>review(c.id).completed).length;
 $('#progress-label').textContent = `${count} of ${calls.length} reviewed`; $('#progress-percent').textContent = `${Math.round(count/calls.length*100)}%`; $('#progress').value = count; $('#progress').max = calls.length;
}
function render() {
 const call = calls.find(c=>c.id===activeId), r = review(); selected = new Set(r.draft.turns);
 const i = calls.indexOf(call);
 $('#main').innerHTML = `<div class="call-heading"><div><span class="eyebrow">CALL REVIEW</span><h2>${call.id} <span class="badge ${status(call.id)}">${labels[status(call.id)]}</span></h2><div class="call-meta">20 Oct 2026 <span class="meta-dot">·</span> ${esc(call.estimated_duration)} <span class="meta-dot">·</span> ${i+1} / ${calls.length}</div></div><div class="navigation"><button id="previous" ${i===0?'disabled':''} aria-label="Previous call">← Previous</button><button id="next" ${i===calls.length-1?'disabled':''} aria-label="Next call">Next →</button></div></div>
 <div class="review-grid"><div class="column">
 <section class="panel"><div class="panel-head"><h3><span class="section-icon" aria-hidden="true">≡</span> Summary</h3><small>Generated</small></div><div class="panel-body"><p class="helper">${r.completed?'Finished · Reopen to edit.':'Highlight text to add a finding.'}</p><p class="summary-text" id="summary-text" tabindex="0" aria-label="Summary text. Select words to create a draft finding.">${summaryMarkup(call)}</p></div></section>
 <section class="panel" id="findings-panel" hidden><div class="panel-head"><h3>Findings</h3><span id="finding-count" class="evidence-count">${r.findings.length} findings</span></div><div class="panel-body"><div id="findings"></div>
 <div id="pending-drafts" aria-label="Other draft findings"></div><form id="finding-form" class="finding-form" novalidate hidden><h4 id="finding-editor-title">New finding</h4><blockquote id="draft-quote" hidden></blockquote><div class="form-grid"><div><label class="field" for="category">Issue</label><select id="category"><option value="">Choose an issue…</option>${categories.map(t=>`<option ${r.draft.category===t?'selected':''}>${t}</option>`).join('')}</select></div><div><label class="field" for="certainty">Certainty</label><select id="certainty"><option ${r.draft.certainty==='Definite error'?'selected':''}>Definite error</option><option ${r.draft.certainty==='Uncertain'?'selected':''}>Uncertain</option></select></div></div><label class="field" for="finding-text">Note</label><textarea id="finding-text" maxlength="5000" placeholder="Add a note…">${esc(r.draft.text)}</textarea><p class="helper" style="margin:8px 0" id="selected-evidence"></p><div class="button-row"><button type="button" id="clear-selection">Clear turns</button><button type="button" id="discard-draft" class="compact">Discard draft</button><button type="submit" id="save-finding" class="primary compact">Add finding</button></div><p id="finding-feedback" class="action-feedback" role="status" aria-live="polite"></p></form></div></section>
 <section class="panel"><div class="panel-head"><h3>Decision</h3><button id="reopen-review" class="compact" ${r.completed?'':'hidden'}>Reopen review</button><span id="review-state" class="saved-state">${r.completed?'Review saved':'Draft · saved in browser'}</span></div><div class="panel-body"><div class="decision-options">${['acceptable','correction','uncertain'].map(v=>`<label><input type="radio" name="decision" value="${v}" ${r.decision===v?'checked':''}>${labels[v]}</label>`).join('')}</div><details class="optional-section" ${r.corrected?'open':''}><summary>Corrected summary <span>Optional</span></summary><label class="sr-only" for="corrected-summary">Corrected summary</label><textarea id="corrected-summary" placeholder="Write a corrected summary…">${esc(r.corrected)}</textarea><button id="copy-original" style="font-size:10px;margin-top:7px">Copy original</button></details><details class="optional-section" ${r.notes?'open':''}><summary>Review note <span>Optional</span></summary><label class="sr-only" for="review-notes">Review note</label><textarea id="review-notes" placeholder="Add a review note…">${esc(r.notes)}</textarea></details><div class="button-row finish-row"><small>Saved automatically</small><button id="save-review" class="primary">Finish review <span aria-hidden="true">→</span></button></div><p id="review-feedback" class="action-feedback" role="status" aria-live="polite"></p></div></section></div>
 <section class="panel transcript-panel"><div class="panel-head"><h3><span class="section-icon" aria-hidden="true">≋</span> Transcript</h3><span class="evidence-count">${turns(call).length} turns</span></div><div class="transcript-toolbar"><label class="sr-only" for="transcript-search">Search this transcript</label><input id="transcript-search" type="search" placeholder="Search transcript…"><button id="clear-search">Clear</button></div><div class="transcript-scroll" id="transcript">${turns(call).map(t=>`<article class="turn ${selected.has(t.id)?'selected':''}" id="turn-${t.id}" data-text="${esc((t.speaker+' '+t.text).toLowerCase())}"><button class="turn-select" data-turn="${t.id}" aria-label="Select ${call.id} ${t.id} as evidence" aria-pressed="${selected.has(t.id)}">${t.id}</button><div><div class="speaker">${esc(t.speaker)}<span>${esc(t.time)}</span></div><p>${esc(t.text)}</p></div></article>`).join('')}<p id="no-turns" class="empty" hidden>No transcript turns match.</p></div></section></div>`;
 renderQueue(); renderFindings(); loadDraft(); bind(call,i);
 if(r.completed){
  document.querySelectorAll('[name=decision], #corrected-summary, #review-notes, #copy-original, #save-review, [data-edit], [data-remove]').forEach(el=>el.disabled=true);
  $('#save-review').textContent='Review finished';
 }

}
function updateSelection() {
 $('#selected-evidence').textContent = selected.size ? `Evidence: ${activeId} · ${[...selected].sort().join(', ')}` : 'Select transcript turns to link evidence.';
 document.querySelectorAll('[data-turn]').forEach(b=>{b.setAttribute('aria-pressed',String(selected.has(b.dataset.turn)));b.closest('.turn').classList.toggle('selected',selected.has(b.dataset.turn));});
}
function renderFindings() {
 const r = review(); $('#finding-count').textContent = `${r.findings.length} finding${r.findings.length===1?'':'s'}`;
 $('#findings').innerHTML = r.findings.length ? r.findings.map(f=>`<article class="finding"><div class="finding-top"><strong>${esc(f.category)} · ${esc(f.certainty)}</strong><span class="finding-actions"><button class="compact" data-edit="${esc(f.id)}" aria-label="Edit finding">Edit</button><button class="remove" data-remove="${esc(f.id)}" aria-label="Remove finding">Remove</button></span></div>${f.quote?`<blockquote>${esc(f.quote)}</blockquote>`:''}<p>${esc(f.text)}</p><div class="evidence-links">${f.turns.map(t=>`<button data-evidence="${esc(t)}">${activeId} · ${esc(t)} ↗</button>`).join('')}</div></article>`).join('') : '<p class="empty">No findings recorded. An accurate summary may need none.</p>';
}
function bind(call,i) {
 $('#reopen-review').onclick=()=>{review().completed=false;persist();render();notice(`${activeId} reopened. You can edit findings and finish the review again.`);};
 $('#summary-text').onmouseup=captureHighlight;
 $('#summary-text').onkeyup=e=>{if(e.key==='Shift')captureHighlight();};
 $('#pending-drafts').onclick=e=>{const b=e.target.closest('[data-draft]');if(!b||review().completed)return;const r=review(),next=r.pending.splice(Number(b.dataset.draft),1)[0];if(hasDraft(r.draft))r.pending.push(r.draft);r.draft=next;persist();loadDraft();renderSummary();feedback('#finding-feedback','Draft opened.',false);};
 $('#discard-draft').onclick=()=>{review().draft=emptyDraft();persist();loadDraft();renderSummary();feedback('#finding-feedback','Draft discarded.',false);};

 $('#previous').onclick=()=>openCall(calls[i-1]?.id); $('#next').onclick=()=>openCall(calls[i+1]?.id);
 $('#transcript').onclick=e=>{const b=e.target.closest('[data-turn]');if(!b)return; if(review().completed)return;if(!hasDraft(review().draft)){notice('Highlight summary text first to open a finding, or choose Edit on a saved finding.');return;} const id=b.dataset.turn;selected.has(id)?selected.delete(id):selected.add(id);review().draft.turns=[...selected];markDraft();updateSelection();};
 $('#clear-selection').onclick=()=>{selected.clear();review().draft.turns=[];persist();updateSelection();};
 const searchTranscript=()=>{const q=$('#transcript-search').value.toLowerCase();let n=0;document.querySelectorAll('.turn').forEach(t=>{t.hidden=!t.dataset.text.includes(q);if(!t.hidden)n++;});$('#no-turns').hidden=n>0;};
 $('#transcript-search').oninput=searchTranscript;$('#clear-search').onclick=()=>{$('#transcript-search').value='';searchTranscript();};
 for(const id of ['category','certainty','finding-text']) $('#'+id).oninput=()=>{const d=review().draft;d.category=$('#category').value;d.certainty=$('#certainty').value;d.text=$('#finding-text').value;markDraft();};
 $('#finding-form').onsubmit=e=>{
 e.preventDefault();const r=review(),text=$('#finding-text').value.trim();
 if(!$('#category').value){feedback('#finding-feedback','Choose an issue type before adding the finding.');$('#category').focus();return;}
 if(!text){feedback('#finding-feedback','Add a note explaining the issue. The highlighted quote is already captured.');$('#finding-text').focus();return;}
 if(!selected.size){feedback('#finding-feedback','Select at least one turn ID in the transcript as evidence, then click Add finding again.');return;}
 const {editingId,...draft}=r.draft;
 const finding={...draft,id:editingId||newId(),category:$('#category').value,certainty:$('#certainty').value,text,turns:[...selected].sort()};
 if(editingId){const index=r.findings.findIndex(f=>f.id===editingId);if(index<0){feedback('#finding-feedback','This finding was removed. Discard this edit and highlight the passage again.');return;}r.findings[index]=finding;}else r.findings.push(finding);
 r.draft=emptyDraft();markDraft();renderFindings();loadDraft();renderSummary();notice(`${editingId?'Finding updated':'Finding added'}. ${r.findings.length} saved for ${activeId}. Highlight another passage to add a finding.`);
 };
 $('#findings').onclick=e=>{
 const edit=e.target.closest('[data-edit]'),remove=e.target.closest('[data-remove]'),link=e.target.closest('[data-evidence]'),r=review();
 if(edit){
  if(r.completed)return;const id=edit.dataset.edit;if(r.draft.editingId===id){$('#finding-text').focus();return;}
  const queued=r.pending.findIndex(d=>d.editingId===id),existing=queued>=0?r.pending.splice(queued,1)[0]:null;
  if(hasDraft(r.draft))r.pending.push(r.draft);
  const f=r.findings.find(f=>f.id===id);r.draft=existing||{...emptyDraft(),...f,turns:[...f.turns],editingId:id};
  persist();loadDraft();renderSummary();$('#finding-text').focus();
 }
 if(remove){if(r.completed)return;const id=remove.dataset.remove;r.findings=r.findings.filter(f=>f.id!==id);r.pending=r.pending.filter(d=>d.editingId!==id);if(r.draft.editingId===id)r.draft=emptyDraft();markDraft();renderFindings();loadDraft();renderSummary();}
 if(link){$('#clear-search').click();const t=$('#turn-'+link.dataset.evidence);t.scrollIntoView({behavior:'smooth',block:'center'});t.classList.remove('flash');requestAnimationFrame(()=>t.classList.add('flash'));}
 };
 document.querySelectorAll('[name=decision]').forEach(el=>el.onchange=()=>{review().decision=el.value;markDraft();});
 $('#corrected-summary').oninput=()=>{review().corrected=$('#corrected-summary').value;markDraft();};$('#review-notes').oninput=()=>{review().notes=$('#review-notes').value;markDraft();};
 $('#copy-original').onclick=()=>{if(review().corrected.trim() && !confirm('Replace your corrected summary with the original?'))return;review().corrected=call.summary;$('#corrected-summary').value=call.summary;markDraft();};
 $('#save-review').onclick=()=>{
 const r=review(), fail=message=>feedback('#review-feedback',message);
 if(!r.decision){fail('Choose Acceptable, Needs correction or Uncertain above, then finish the review.');return;}
 if(hasDraft(r.draft)||r.pending.length){fail('You have unfinished findings. Add them or discard each draft before finishing.');return;}
 if(r.decision==='correction'&&!r.findings.some(f=>f.certainty==='Definite error'&&f.turns.length)){fail('Needs correction requires a definite finding with transcript evidence. Add one, or choose Uncertain.');return;}
 if(r.decision==='acceptable'&&r.findings.length){fail('This call has findings. Remove them if resolved, or choose Needs correction or Uncertain.');return;}
 if(r.decision==='uncertain'&&!r.findings.length&&!r.notes.trim()){fail('Add a note or finding explaining the uncertainty before finishing.');return;}
 r.completed=true;r.reviewedAt=new Date().toISOString();persist();
 const next=[...calls.slice(i+1),...calls.slice(0,i)].find(c=>!review(c.id).completed);
 if(next){openCall(next.id);notice(`${call.id} review finished. Now reviewing ${next.id}.${!storageAvailable||savedDataInvalid?' Browser saving unavailable: export to keep your work.':''}`);}
 else{render();feedback('#review-feedback',storageAvailable&&!savedDataInvalid?'All calls reviewed. You can export your reviews or revisit a call from the queue.':'All calls reviewed in memory. Export before closing the tab.',false);notice('All calls reviewed. Export your results when ready.');}

 };

}
function openCall(id){
 if(!id||id===activeId)return;
 const previous=activeId,unfinished=previous&&!review(previous).completed;
 activeId=id;render();$('#main').focus({preventScroll:true});$('#main').scrollIntoView({behavior:'smooth',block:'start'});
 notice(unfinished?`${previous} is unfinished. ${storageAvailable&&!savedDataInvalid?'Your draft is saved; return any time.':'Export to keep your draft.'}`:'');
}
function reportHtml() {
 const finished=calls.filter(c=>review(c.id).completed).length;
 const findingHtml=(f,call,draft=false)=>`<article class="finding"><h4>${draft?'Draft finding':esc(f.category)}${f.certainty?' · '+esc(f.certainty):''}</h4>${f.quote?`<blockquote>${esc(f.quote)}</blockquote>`:''}<p>${esc(f.text||'No note added.')}</p>${f.turns.length?`<h5>Transcript evidence</h5>${f.turns.map(id=>`<p class="evidence"><strong>${call.id} · ${esc(id)}</strong><br>${esc(call.transcript.split('\n').find(line=>line.startsWith(id+' '))||'Turn unavailable')}</p>`).join('')}`:'<p class="muted">No transcript turns linked.</p>'}</article>`;
 const sections=calls.map(c=>{const r=review(c.id),drafts=[...r.pending,r.draft].filter(hasDraft);return `<section id="${c.id}"><h2>${c.id} <span class="badge ${status(c.id)}">${labels[status(c.id)]}</span></h2>${!r.completed&&r.decision?`<p class="muted">Draft decision: ${labels[r.decision]} — review not finished.</p>`:''}${r.reviewedAt&&r.completed?`<p class="muted">Reviewed ${esc(new Date(r.reviewedAt).toLocaleString('en-GB'))}</p>`:''}<details><summary>Original summary</summary><p>${esc(c.summary)}</p></details>${r.findings.length?`<h3>Findings</h3>${r.findings.map(f=>findingHtml(f,c)).join('')}`:'<p class="muted">No findings recorded.</p>'}${r.corrected?`<h3>Corrected summary</h3><p>${esc(r.corrected)}</p>`:''}${r.notes?`<h3>Review note</h3><p>${esc(r.notes)}</p>`:''}${drafts.length?`<h3>Unfinished findings</h3>${drafts.map(f=>findingHtml(f,c,true)).join('')}`:''}</section>`;}).join('');
 return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SoundSenseAI review report</title><style>
 body{font:15px/1.75 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#263c32;background:#f4f6f1;margin:0;padding:36px 20px}main{max-width:900px;margin:auto;background:white;border:1px solid #dce4d7;border-radius:14px;padding:36px}h1{font-size:30px;letter-spacing:-1px;margin:0}h2{font-size:21px}h3{font-size:15px;margin-top:24px}h4,h5{margin:0 0 8px;font-size:12px}p{white-space:pre-wrap}a{color:#176b51}.muted{color:#778371;font-size:12px}.stats{display:flex;gap:12px;flex-wrap:wrap;margin:26px 0}.stat{background:#f2f6ec;padding:13px 20px;border-radius:9px;flex:1;min-width:120px}.stat strong{display:block;font-size:25px}.stat span{font-size:11px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;padding:10px;border-bottom:1px solid #e7ece2}th{background:#f6f8f2}.badge{display:inline-block;background:#eef1e9;color:#69765e;font-size:11px;border-radius:20px;padding:3px 10px;vertical-align:middle}.acceptable{background:#e8f3e6;color:#346c3c}.correction{background:#fbece9;color:#a33c35}.uncertain{background:#fff4d8;color:#916413}section:first-of-type{border-top:0;margin-top:10px}footer{border-top:1px solid #dce4d7;margin-top:30px;padding-top:20px;font-size:13px}section{border-top:1px solid #dce4d7;margin-top:30px;padding-top:12px;scroll-margin:20px}.finding{border:1px solid #e2e7dc;padding:16px;border-radius:8px;margin:12px 0;break-inside:avoid}blockquote{margin:10px 0;padding:10px 14px;border-left:3px solid #d2bc64;background:#fff9e7;white-space:pre-wrap}.evidence{font-size:12px;color:#5a6c51}summary{cursor:pointer;font-size:12px;color:#63775b}@media print{body{padding:0;background:white}main{border:0;padding:0}a{color:inherit}.finding{break-inside:avoid}h2,h3{break-after:avoid}}
 </style></head><body><main><p class="muted">SOUNDSENSEAI · REVIEW REPORT · ${esc(new Date().toLocaleString('en-GB'))}</p>${sections}<footer><strong>${finished} of ${calls.length} reviews finished</strong><p class="muted">Fictional assessment data. Unfinished calls and draft findings are labelled above.</p></footer></main></body></html>`;
}

function exportReviews(){
 const url=URL.createObjectURL(new Blob([reportHtml()],{type:'text/html;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='soundsense-review-report.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notice('Report downloaded. Open it in your browser to read your reviews.');
}
async function init(){
 try{const response=await fetch('data/calls.json');if(!response.ok)throw new Error('Dataset request failed');calls=await response.json();if(!Array.isArray(calls)||!calls.length||calls.some(c=>!c.id||typeof c.transcript!=='string'||typeof c.summary!=='string'))throw new Error('Invalid dataset');calls.sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}));
 try{const saved=localStorage.getItem(KEY);if(saved){const parsed=JSON.parse(saved);if(parsed.version!==1||!parsed.reviews||typeof parsed.reviews!=='object')throw new Error('Invalid saved data');for(const c of calls){const r=parsed.reviews[c.id];if(!r)continue;if(!Array.isArray(r.findings)||r.findings.some(f=>!f||typeof f.id!=='string'||!categories.includes(f.category)||!['Definite error','Uncertain'].includes(f.certainty)||typeof f.text!=='string'||!Array.isArray(f.turns)||f.turns.some(t=>!turns(c).some(turn=>turn.id===t)))||!r.draft||!Array.isArray(r.draft.turns)||typeof r.corrected!=='string'||typeof r.notes!=='string'||(r.decision&&!['acceptable','correction','uncertain'].includes(r.decision)))throw new Error('Invalid saved review');}reviews=parsed.reviews;}}
 catch{savedDataInvalid=true;notice('Saved progress could not be loaded. It has not been overwritten. Export or recover stored data before making new edits.');reviews={};}
 activeId=calls[0].id;render();$('#search').oninput=renderQueue;$('#filter').onchange=renderQueue;$('#call-list').onclick=e=>{const b=e.target.closest('[data-call]');if(b)openCall(b.dataset.call);};$('#export').onclick=exportReviews;

 }catch(error){$('#main').innerHTML='<section class="panel"><div class="panel-body"><h2>Could not load the calls</h2><p>Serve this folder through a web server, then reload. The dataset must be available at data/calls.json.</p><button onclick="location.reload()">Try again</button></div></section>';notice(error.message);}
}
$('#rules-open').onclick=()=>$('#rules-dialog').showModal();$('#rules-close').onclick=()=>$('#rules-dialog').close();
Promise.allSettled([['data/summary-rules.txt','#full-rules'],['data/candidate-readme.md','#full-readme']].map(async([url,target])=>{const r=await fetch(url);if(!r.ok)throw new Error('Guidance unavailable');$(target).textContent=await r.text();})).then(results=>results.forEach((r,i)=>{if(r.status==='rejected')$(['#full-rules','#full-readme'][i]).textContent='Could not load this reference. Reload to try again.';}));
init();
