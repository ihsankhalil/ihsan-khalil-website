(() => {
  const cfg = window.ZENON_CONFIG || {};
  const supabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  let session = null, items = [], media = [], currentType = 'gedanke', editingId = null;

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const toast = m => { const t=$('#toast'); t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2000); };
  const format = d => d ? new Intl.DateTimeFormat('de-DE',{dateStyle:'medium',timeStyle:'short'}).format(new Date(d)) : 'Ohne Datum';
  const typeLabel = t => ({gedanke:'Gedanken',news:'News',termin:'Termine',buch:'Buch intern'})[t]||t;

  async function boot() {
    const { data } = await supabase.auth.getSession();
    session = data.session;
    toggleAuth();
    supabase.auth.onAuthStateChange((_event,newSession)=>{session=newSession;toggleAuth();});
  }

  function toggleAuth() {
    $('#loginScreen').classList.toggle('hidden', !!session);
    $('#app').classList.toggle('hidden', !session);
    if (session) {
      $('#userEmail').textContent = session.user.email;
      loadAll();
    }
  }

  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault(); $('#loginError').textContent='';
    const { error } = await supabase.auth.signInWithPassword({
      email: $('#loginEmail').value.trim(),
      password: $('#loginPassword').value
    });
    if (error) $('#loginError').textContent='Anmeldung nicht möglich. E-Mail oder Passwort prüfen.';
  });
  $('#logoutBtn').addEventListener('click',()=>supabase.auth.signOut());

  async function loadAll() {
    const [{data:i,error:ie},{data:m,error:me}] = await Promise.all([
      supabase.from('content_items').select('*').order('updated_at',{ascending:false}),
      supabase.storage.from(cfg.mediaBucket).list('',{limit:1000,sortBy:{column:'created_at',order:'desc'}})
    ]);
    if (ie) return alert('Inhalte konnten nicht geladen werden: '+ie.message);
    items=i||[];
    media=(m||[]).filter(x=>x.name!=='.emptyFolderPlaceholder').map(x=>({
      name:x.name,url:supabase.storage.from(cfg.mediaBucket).getPublicUrl(x.name).data.publicUrl
    }));
    renderDashboard();
    fillImages();
  }

  function show(view) {
    $$('.view').forEach(v=>v.classList.remove('active'));
    $('#'+view+'View').classList.add('active');
    $('#sidebar').classList.remove('open');
  }

  function row(i){return `<div class="row" data-id="${i.id}"><div><b>${esc(i.title||'Ohne Titel')}</b><small>${esc(i.excerpt||i.subtitle||'')}</small></div><span class="badge">${esc(i.status)}</span><span class="meta">${typeLabel(i.type)} · ${format(i.publish_at)}</span></div>`}
  function bindRows(){ $$('[data-id]').forEach(r=>r.addEventListener('click',()=>openEditor(r.dataset.id))); }

  function renderDashboard() {
    show('dashboard');
    $('#stats').innerHTML=['Entwurf','Geplant','Veröffentlicht','Archiviert'].map(s=>`<div class="stat"><b>${items.filter(i=>i.status===s).length}</b><span>${s}</span></div>`).join('');
    $('#recentList').innerHTML=items.slice(0,8).map(row).join('')||'<div class="row">Noch keine Inhalte</div>';
    bindRows();
  }

  function renderList(type) {
    currentType=type; show('list');
    $('#listEyebrow').textContent=type==='archiv'?'ARCHIV':typeLabel(type).toUpperCase();
    $('#listTitle').textContent=type==='archiv'?'Archiv':typeLabel(type);
    $('#newBtn').style.display=type==='archiv'?'none':'';
    filterList();
  }
  function filterList(){
    const q=$('#search').value.toLowerCase(), st=$('#statusFilter').value;
    let data=currentType==='archiv'?items.filter(i=>i.status==='Archiviert'):items.filter(i=>i.type===currentType);
    data=data.filter(i=>(!st||i.status===st)&&(!q||JSON.stringify(i).toLowerCase().includes(q)));
    $('#contentList').innerHTML=data.map(row).join('')||'<div class="row">Keine Inhalte</div>'; bindRows();
  }

  function fillImages(selected=''){
    $('#imageSelect').innerHTML='<option value="">Kein Bild</option>'+media.map(m=>`<option value="${esc(m.name)}">${esc(m.name)}</option>`).join('');
    $('#imageSelect').value=selected||''; imagePreview();
  }
  function imagePreview(){ const m=media.find(x=>x.name===$('#imageSelect').value); $('#imagePreview').innerHTML=m?`<img src="${m.url}">`:'Kein Bild'; }

  function openEditor(idOrType) {
    let item=items.find(i=>i.id===idOrType);
    editingId=item?.id||null;
    item=item||{type:idOrType||'gedanke',status:'Entwurf',title:'',subtitle:'',excerpt:'',quote:'',body:'',closing_question:'',publish_at:'',category:'',tags:'',image_path:'',location:'',link:'',internal_note:''};
    show('editor'); $('#editorHeading').textContent=editingId?'Inhalt bearbeiten':'Neuer Inhalt';
    [...$('#editorForm').elements].forEach(el=>{if(el.name) el.value=item[el.name]??''});
    fillImages(item.image_path);
    $('#deleteBtn').style.display=editingId?'':'none';
  }

  async function saveItem() {
    if(!$('#editorForm').reportValidity())return;
    const v=Object.fromEntries(new FormData($('#editorForm')).entries());
    v.tags=(v.tags||'').split(',').map(x=>x.trim()).filter(Boolean);
    v.publish_at=v.publish_at||null;
    v.updated_at=new Date().toISOString();
    let result;
    if(editingId) result=await supabase.from('content_items').update(v).eq('id',editingId).select().single();
    else result=await supabase.from('content_items').insert(v).select().single();
    if(result.error)return alert(result.error.message);
    toast('Gespeichert'); await loadAll(); renderList(result.data.type);
  }

  async function deleteItem(){
    if(!editingId||!confirm('Inhalt wirklich löschen?'))return;
    const {error}=await supabase.from('content_items').delete().eq('id',editingId);
    if(error)return alert(error.message); toast('Gelöscht'); await loadAll(); renderDashboard();
  }

  async function uploadMedia(files){
    for(const file of files){
      const safe=`${Date.now()}-${file.name.toLowerCase().replace(/[^a-z0-9._-]+/g,'-')}`;
      const {error}=await supabase.storage.from(cfg.mediaBucket).upload(safe,file,{upsert:false});
      if(error) alert(`${file.name}: ${error.message}`);
    }
    await loadAll(); renderMedia(); toast('Upload abgeschlossen');
  }
  function renderMedia(){
    show('media');
    $('#mediaGrid').innerHTML=media.map(m=>`<article class="media-card"><img src="${m.url}"><div><b>${esc(m.name)}</b><br><button class="button ghost" data-delete-media="${esc(m.name)}">Löschen</button></div></article>`).join('')||'Noch keine Bilder';
    $$('[data-delete-media]').forEach(b=>b.onclick=async()=>{if(confirm('Bild löschen?')){await supabase.storage.from(cfg.mediaBucket).remove([b.dataset.deleteMedia]);await loadAll();renderMedia();}});
  }

  function preview(){
    const v=Object.fromEntries(new FormData($('#editorForm')).entries()), m=media.find(x=>x.name===v.image_path);
    $('#previewArticle').innerHTML=`${m?`<img src="${m.url}">`:''}<small>${typeLabel(v.type)} · ${format(v.publish_at)}</small><h1>${esc(v.title||'Ohne Titel')}</h1>${v.subtitle?`<h2>${esc(v.subtitle)}</h2>`:''}${v.quote?`<blockquote>${esc(v.quote)}</blockquote>`:''}${(v.body||'').split(/\n\s*\n/).filter(Boolean).map(p=>`<p>${esc(p)}</p>`).join('')}`;
    $('#previewDialog').showModal();
  }

  async function publish(){
    if(!confirm('Öffentliche Inhalte jetzt in das Website-Repository übertragen?'))return;
    const {data,error}=await supabase.functions.invoke(cfg.publishFunction,{body:{action:'publish'}});
    if(error)return alert('Veröffentlichung fehlgeschlagen: '+error.message);
    toast(data?.message||'Website-Aktualisierung angestoßen');
  }

  $$('.nav').forEach(b=>b.onclick=()=>b.dataset.view==='dashboard'?renderDashboard():b.dataset.view==='medien'?renderMedia():renderList(b.dataset.view));
  $$('[data-new]').forEach(b=>b.onclick=()=>openEditor(b.dataset.new));
  $('#newBtn').onclick=()=>openEditor(currentType); $('#backBtn').onclick=()=>renderDashboard();
  $('#saveBtn').onclick=saveItem; $('#deleteBtn').onclick=deleteItem; $('#previewBtn').onclick=preview;
  $('#closePreview').onclick=()=>$('#previewDialog').close(); $('#imageSelect').onchange=imagePreview;
  $('#search').oninput=filterList; $('#statusFilter').onchange=filterList;
  $('#mediaInput').onchange=e=>uploadMedia([...e.target.files]);
  $('#publishBtn').onclick=publish; $('#menuBtn').onclick=()=>$('#sidebar').classList.toggle('open');
  boot();
})();