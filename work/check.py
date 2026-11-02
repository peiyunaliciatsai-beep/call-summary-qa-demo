import ctypes, pathlib, json
j=ctypes.CDLL('/System/Library/Frameworks/JavaScriptCore.framework/JavaScriptCore')
j.JSGlobalContextCreate.argtypes=[ctypes.c_void_p];j.JSGlobalContextCreate.restype=ctypes.c_void_p
j.JSStringCreateWithUTF8CString.argtypes=[ctypes.c_char_p];j.JSStringCreateWithUTF8CString.restype=ctypes.c_void_p
j.JSEvaluateScript.argtypes=[ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_int,ctypes.POINTER(ctypes.c_void_p)];j.JSEvaluateScript.restype=ctypes.c_void_p
j.JSValueToStringCopy.argtypes=[ctypes.c_void_p,ctypes.c_void_p,ctypes.POINTER(ctypes.c_void_p)];j.JSValueToStringCopy.restype=ctypes.c_void_p
j.JSStringGetMaximumUTF8CStringSize.argtypes=[ctypes.c_void_p];j.JSStringGetMaximumUTF8CStringSize.restype=ctypes.c_size_t
j.JSStringGetUTF8CString.argtypes=[ctypes.c_void_p,ctypes.c_void_p,ctypes.c_size_t];j.JSStringGetUTF8CString.restype=ctypes.c_size_t
source=pathlib.Path('app.js').read_text().split("$('#rules-open').onclick")[0]
stubs='''
const nodes=new Map();
function node(s){if(!nodes.has(s))nodes.set(s,{value:s==='#filter'?'all':'',textContent:'',innerHTML:'',classList:{toggle(){},add(){},remove(){}},scrollIntoView(){},focus(){},contains(){return true}});return nodes.get(s)}
const document={querySelector:node,querySelectorAll:()=>[]};
const localStorage={data:{},setItem(k,v){this.data[k]=v},getItem(k){return this.data[k]||null}};
const window={}; const requestAnimationFrame=f=>f();
'''
tests='''
const results=[];function check(test, condition){if(!condition)throw Error(test);results.push(test)}
calls=DATA;calls.sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}));activeId=calls[0].id;render();
check('Queue sorted CALL-001 through CALL-020',calls[0].id==='CALL-001'&&calls[19].id==='CALL-020');
const allCalls=calls; calls=[calls[0]];
check('Finding panel and editor hidden on first view',$('#findings-panel').hidden&&$('#finding-form').hidden);
$('#save-review').onclick();check('Finish without decision gives inline feedback',$('#review-feedback').textContent.includes('Choose Acceptable'));
$('#finding-form').onsubmit({preventDefault(){}});check('Missing category gives inline feedback',$('#finding-feedback').textContent.includes('Choose an issue'));
$('#category').value='Contradiction';$('#finding-form').onsubmit({preventDefault(){}});check('Missing note gives inline feedback',$('#finding-feedback').textContent.includes('Add a note'));
$('#finding-text').value='Wrong payment amount';$('#finding-form').onsubmit({preventDefault(){}});check('Missing evidence gives inline feedback',$('#finding-feedback').textContent.includes('Select at least one'));
review().draft={...emptyDraft(),quote:calls[0].summary.slice(0,13),start:0,end:13};selected.add('T15');$('#certainty').value='Definite error';$('#finding-form').onsubmit({preventDefault(){}});
check('Add finding stores quote, note and evidence',review().findings.length===1&&review().findings[0].quote==='DPA completed'&&review().findings[0].turns[0]==='T15');
check('Saved finding highlights original summary',summaryMarkup(calls[0]).startsWith('<mark>DPA completed</mark>'));
check('Editor hidden after save, saved finding remains visible',$('#finding-form').hidden&&!$('#findings-panel').hidden);
const findingId=review().findings[0].id;
$('#findings').onclick({target:{closest:s=>s==='[data-edit]'?{dataset:{edit:findingId}}:null}});
check('Edit opens saved note, quote and evidence',!$('#finding-form').hidden&&review().draft.editingId===findingId&&$('#finding-text').value==='Wrong payment amount'&&selected.has('T15'));
$('#finding-text').value='Corrected note';$('#finding-form').onsubmit({preventDefault(){}});
check('Save changes updates finding in place',review().findings.length===1&&review().findings[0].id===findingId&&review().findings[0].text==='Corrected note');
$('#findings').onclick({target:{closest:s=>s==='[data-edit]'?{dataset:{edit:findingId}}:null}});$('#finding-text').value='Unsaved edit';$('#discard-draft').onclick();
check('Cancel edit preserves original finding',review().findings[0].text==='Corrected note'&&$('#finding-form').hidden);
review().decision='correction';$('#save-review').onclick();check('Finish correction saves completed review',review().completed===true&&status(activeId)==='correction');
review().pending.push({...emptyDraft(),quote:'other'});$('#save-review').onclick();check('Pending highlights block finish with explanation',$('#review-feedback').textContent.includes('unfinished findings'));review().pending=[];
review().findings=[];review().decision='acceptable';$('#save-review').onclick();check('Acceptable review finishes without findings',review().completed&&status(activeId)==='acceptable');
const summary=calls[0].summary;function highlight(start,end){window.getSelection=()=>({isCollapsed:false,rangeCount:1,getRangeAt:()=>({startContainer:{},endContainer:{},startOffset:start,toString:()=>summary.slice(start,end),cloneRange:()=>({selectNodeContents(){},setEnd(){},toString:()=>summary.slice(0,start)})}),removeAllRanges(){}});captureHighlight()}
highlight(0,13);check('Finished review ignores new highlights',!hasDraft(review().draft));$('#reopen-review').onclick();check('Reopen enables editing',!review().completed);highlight(0,13);check('Highlight automatically captures quote and opens editor',review().draft.quote==='DPA completed'&&!review().completed&&!$('#finding-form').hidden);
review().draft.text='First draft note';highlight(15,27);check('Second highlight retains first draft and its note',review().pending.length===1&&review().pending[0].text==='First draft note');
check('Overlapping highlights merge safely',(()=>{review().draft={...emptyDraft(),quote:summary.slice(5,20),start:5,end:20};return (summaryMarkup(calls[0]).match(/<mark>/g)||[]).length===1})());
check('Drafts and saved reviews persist together',JSON.parse(localStorage.data[KEY]).reviews[activeId].pending.length===1);
check('Markup escapes unsafe summary text',(()=>{review().pending=[];review().draft=emptyDraft();return summaryMarkup({summary:'<script>'})==='&lt;script&gt;'})());
calls=allCalls;reviews={};activeId=calls[0].id;review().decision='acceptable';render();$('#save-review').onclick();
check('Finish review advances to next unfinished call',activeId==='CALL-002'&&review('CALL-001').completed);
review('CALL-003').completed=true;review('CALL-003').decision='acceptable';review().decision='acceptable';$('#save-review').onclick();
check('Automatic advance skips completed calls',activeId==='CALL-004');
activeId='CALL-020';review().decision='acceptable';render();$('#save-review').onclick();
check('Advance wraps to earlier unfinished call',activeId==='CALL-004');
for(const c of calls){review(c.id).completed=true;review(c.id).decision='acceptable';}activeId='CALL-020';render();$('#save-review').onclick();
check('Final review shows completion message',$('#review-feedback').textContent.includes('All calls reviewed'));
review().completed=false;openCall('CALL-019');check('Leaving unfinished call shows non-blocking reminder',$('#notice').textContent.includes('CALL-020 is unfinished')&&activeId==='CALL-019');
const reportCall=calls.find(c=>c.id===activeId);review().findings=[{id:'report-test',category:'Contradiction',certainty:'Definite error',quote:'<unsafe quote>',text:'Report note & detail',turns:['T08']}];review().notes='A review note';review().corrected='Corrected summary content';review().draft={...emptyDraft(),text:'Unfinished note'};
const html=reportHtml();
check('Report starts with calls, has no overview, and ends with progress',!html.includes('<h2>Overview</h2>')&&calls.every(c=>html.includes('id="'+c.id+'"'))&&html.includes('of 20 reviews finished')&&html.indexOf('id="CALL-001"')<html.indexOf('<footer>'));
check('Report includes quoted evidence and review content',html.includes('off sick with depression')&&html.includes('Report note &amp; detail')&&html.includes('Corrected summary content'));
check('Report escapes quotes and labels unfinished findings',html.includes('&lt;unsafe quote&gt;')&&html.includes('<h3>Unfinished findings</h3>')&&html.includes('Unfinished note'));
JSON.stringify({passed:results.length,checks:results});
'''
ctx=j.JSGlobalContextCreate(None);exc=ctypes.c_void_p()
script=stubs+source+tests.replace('DATA',json.dumps(json.load(open('data/calls.json'))),1)
val=j.JSEvaluateScript(ctx,j.JSStringCreateWithUTF8CString(script.encode()),None,None,1,ctypes.byref(exc))
s=j.JSValueToStringCopy(ctx,exc.value or val,None);n=j.JSStringGetMaximumUTF8CStringSize(s);buf=ctypes.create_string_buffer(n);j.JSStringGetUTF8CString(s,buf,n)
print(buf.value.decode());raise SystemExit(1 if exc.value else 0)
