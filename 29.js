/* 29.js - extracted from single-file page (deferred) */

/* ===========================
   Data model & Storage
   =========================== */
const DEFAULT_PAGES = {
  Founding: {
    category: "Foundation",
    title: "Executive Branches",
    // legacy 'sections' will be migrated to tabs automatically on init
    sections: [
      { header: "Founding Doctrine (OCC)", content: "<p>The Office of Central Command stands as the guiding force of the Federation, its authority forged at the dawn of interstellar unification. Charged with maintaining cohesion among distant colonies and ensuring the Federation’s vision endures, the Office is both a council of leadership and a sentinel of ideology.Its founders envisioned a structure where governance and duty are inseparable—every decision reverberates across light-years, shaping the lives of countless citizens. The doctrines emphasize unity, accountability, and vigilance, forming the backbone of the Federation’s enduring order.</p>" },
      { header: "Council of Directives", content: "<p>At the core of the Office lies the Council of Directives, an assembly of the most senior and trusted leaders. They deliberate on matters of law, strategy, and expansion, balancing the needs of individual colonies with the overarching mission of the Federation. Their judgments are swift yet deliberate, ensuring that no decision undermines the collective security or prosperity of the stellar body.</p>" },
      { header: "Symbol of Authority", content: "<p>Every colony recognizes the seal of the Central Command: a circular emblem symbolizing unity and vigilance. It is displayed prominently on all official documents, vessels, and stations, serving as both a mark of leadership and a reminder that every action—from administrative tasks to fleet deployment—falls under the watchful eye of the Federation’s Executive.</p>" },
    ]
  },
 
  Stability: {
    category: "Control & Security",
    title: "Ministry of Stability & Compliance",
    sections: [
      { header: "Compliance Protocols", content: "<p>Internal compliance measures and social order enforcement.</p>" }
    ]
  },
  Security: {
    category: "Control & Security",
    title: "Department of Interstellar Security",
    sections: [
      { header: "Security Mandates", content: "<p>Intelligence and surveillance operations.</p>" }
    ]
  },
  Defense: {
    category: "Control & Security",
    title: "Defense Directorate",
    sections: [
      { header: "Fleet Command", content: "<p>Fleet deployment and planetary defense.</p>" }
    ]
  },
  Colonies: {
    category: "Expansion",
    title: "Bureau of Colonies",
    sections: [
      { header: "Colonial Oversight", content: "<p>Management of colonies and resources.</p>" }
    ]
  },
  Relations: {
    category: "Expansion",
    title: "External Relations Authority",
    sections: [
      { header: "Diplomatic Affairs", content: "<p>Diplomacy, trade, and foreign policy.</p>" }
    ]
  }
};

const STORAGE_KEY = 'wiki_federation_data_v1'; // versioned
const EDITMODE_KEY = 'wiki_federation_editmode_v1';

function loadPagesFromStorage(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return JSON.parse(JSON.stringify(DEFAULT_PAGES));
    return JSON.parse(raw);
  }catch(e){
    console.error('Failed to load pages from storage', e);
    return JSON.parse(JSON.stringify(DEFAULT_PAGES));
  }
}
function savePagesToStorage(pages){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pages));
  }catch(e){ console.error('Failed to save pages', e); }
}

/* ===========================
   Utilities
   =========================== */
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from((root||document).querySelectorAll(sel));
const makeId = (pref='id') => `${pref}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
function escapeHtml(str){ return String(str||'').replace(/[&<>"']/g, (m)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

/* ===========================
   App state
   =========================== */
let PAGES = loadPagesFromStorage();
let currentPageId = null;
let editMode = (localStorage.getItem(EDITMODE_KEY) === 'true');
const sidebarEl = document.getElementById('sidebar');
const contentEl = document.getElementById('content');
const editorToggleBtn = document.getElementById('editorToggle');

/* Editor internal state (when modal open) */
let editorState = null; // { pageId, pageCopy, currentTabId, currentSectionId (string/null), originalSectionHtml }

/* ===========================
   Migration: convert legacy pages (sections[]) into tabs[]
   =========================== */
function migratePagesShape(pages){
  let changed = false;
  for(const pid of Object.keys(pages)){
    const page = pages[pid];
    // if it already has tabs, ensure each section has ids
    if(page.tabs && Array.isArray(page.tabs)){
      page.tabs.forEach(t=>{
        if(!t.id) t.id = makeId('t');
        if(!Array.isArray(t.sections)) t.sections = [];
        t.sections.forEach(s=>{
          if(!s.id) s.id = makeId('s');
          if(typeof s.collapsed === 'undefined') s.collapsed = false;
          if(!s.content && s.html) s.content = s.html; // legacy alias
        });
      });
      if(!page.activeTabId && page.tabs.length) page.activeTabId = page.tabs[0].id;
      continue;
    }
    // legacy: has 'sections' -> convert
    if(page.sections && Array.isArray(page.sections)){
      const tab = {
        id: makeId('t'),
        title: 'Main',
        sections: page.sections.map(s => ({
          id: makeId('s'),
          header: s.header || s.title || 'Untitled',
          content: s.content || s.html || '',
          collapsed: false
        }))
      };
      page.tabs = [tab];
      page.activeTabId = tab.id;
      delete page.sections;
      changed = true;
    } else {
      // no 'sections' or 'tabs' -> create empty tab
      const tab = { id: makeId('t'), title: 'Main', sections: [] };
      page.tabs = [tab];
      page.activeTabId = tab.id;
      changed = true;
    }
  }
  if(changed) savePagesToStorage(pages);
}

/* ===========================
   Sidebar & Page rendering (uses tabs model)
   =========================== */
function buildSidebar(){
  const categories = {};
  for(const pid of Object.keys(PAGES)){
    const p = PAGES[pid];
    if(!categories[p.category]) categories[p.category] = [];
    categories[p.category].push({id:pid,title:p.title});
  }

  sidebarEl.innerHTML = '';
  for(const cat of Object.keys(categories)){
    const h = document.createElement('h4'); h.textContent = cat; sidebarEl.appendChild(h);
    categories[cat].forEach(item=>{
      const a = document.createElement('a');
      a.href = '#'+item.id;
      a.textContent = item.title;
      // store page id in data attr rather than relying on inline onclicks
      a.dataset.pageId = item.id;
      sidebarEl.appendChild(a);
    });
    const div = document.createElement('div'); div.className = 'sidebar-divider'; sidebarEl.appendChild(div);
  }
}

/* Delegated click handler for sidebar links (permanent fix) */
function attachSidebarDelegation(){
  const sb = document.getElementById('sidebar');
  if (!sb) return;
  if (sb.__delegationInstalled) return;
  sb.__delegationInstalled = true;
  sb.addEventListener('click', function(e){
    const a = e.target.closest('a');
    if (!a || !sb.contains(a)) return;
    e.preventDefault();
    const id = a.dataset.pageId || (a.getAttribute('href') || '').replace(/^#/, '');
    if (!id) return;
    if (typeof loadPage === 'function') {
      loadPage(id);
    } else {
      currentPageId = id;
      loadPage(id);
    }
  });
}

function loadPage(pageId){
  currentPageId = pageId;
  const page = PAGES[pageId];
  if(!page) return;
  // ensure activeTab exists
  const activeTab = page.tabs.find(t => t.id === page.activeTabId) || page.tabs[0];

  const breadcrumb = `<div id="breadcrumb"><span class="home" onclick="returnHome()">Home</span> &nbsp; &gt; &nbsp; <span id="sectionHierarchy">${escapeHtml(page.category)} > ${escapeHtml(page.title)}</span></div>`;
  let html = '';
  activeTab.sections.forEach((sec, idx)=>{
    // support legacy header property names (header/title)
    const headerText = sec.header || sec.title || 'Untitled';
    html += `
      <div class="content-box">
        <div class="collapse-section">
          <div class="collapse-header">
            <div class="section-title">
              <h3>${escapeHtml(headerText)}</h3>
            </div>
            <div>
              ${ editMode ? `<button class="edit-btn" onclick="openEditorForSection('${pageId}', '${activeTab.id}', '${sec.id}')">Edit</button>` : '' }
            </div>
          </div>
          <div class="collapse-content" id="section_${pageId}_${activeTab.id}_${sec.id}">
            ${sec.content || ''}
          </div>
        </div>
      </div>`;
  });

  contentEl.innerHTML = breadcrumb + html;

  // collapse toggle behavior
  document.querySelectorAll('.collapse-header').forEach(h=>{
    h.onclick = function(e){
      if(e.target.tagName.toLowerCase() === 'button') return;
      const content = this.parentElement.querySelector('.collapse-content');
      if(!content) return;
      content.style.display = (content.style.display === 'none') ? 'block' : 'none';
    };
  });
}

/* ===========================
   Enter/Return UI
   =========================== */
function enterDatabase(){
  document.getElementById('intro').style.display = 'none';
  sidebarEl.style.display = 'block';
  contentEl.style.display = 'block';
  setTimeout(()=>{
    sidebarEl.style.left = '0px';
    sidebarEl.style.opacity = '1';
    contentEl.style.opacity = '1';
  },50);
}
function returnHome(){
  document.getElementById('intro').style.display = 'block';
  sidebarEl.style.left='-260px';
  sidebarEl.style.opacity='0';
  contentEl.style.opacity='0';
}

/* ===========================
   Editor toggle button
   =========================== */
function updateEditorToggleUI(){
  editorToggleBtn.textContent = editMode ? 'Disable Editing' : 'Enable Editing';
  editorToggleBtn.classList.toggle('editing', editMode);
}
editorToggleBtn.addEventListener('click', ()=>{
  editMode = !editMode;
  localStorage.setItem(EDITMODE_KEY, String(editMode));
  updateEditorToggleUI();
  if(currentPageId) loadPage(currentPageId);
});
updateEditorToggleUI();

/* ===========================
   Editor modal behavior (tabs + sections + content editing)
   =========================== */
const editorModal = document.getElementById('editorModal');
const editorTitle = document.getElementById('editorTitle');
const editorMeta = document.getElementById('editorMeta');
const tabsBar = document.getElementById('tabsBar');
const tabsContainer = document.getElementById('tabsContainer');
const editorArea = document.getElementById('editorArea');
const editorContent = document.getElementById('editorContent');
const codeArea = document.getElementById('codeArea');

const editorSaveBtn = document.getElementById('editorSaveBtn');
const editorSaveAndCloseBtn = document.getElementById('editorSaveAndCloseBtn');
const editorCloseBtn = document.getElementById('editorCloseBtn');
const editorCloseNoSaveBtn = document.getElementById('editorCloseNoSaveBtn');
const editorRevertBtn = document.getElementById('editorRevertBtn');
const addTabBtn = document.getElementById('addTabBtn');
const newTabTitleInput = document.getElementById('newTabTitle');
const codeModeBtn = document.getElementById('codeModeBtn');

let codeMode = false;

/* toolbar execCommand wiring */
document.querySelectorAll('#editorToolbar .tool-btn').forEach(btn=>{
  btn.addEventListener('click', function(e){
    const cmd = this.dataset.cmd;
    const val = this.dataset.value || null;
    if(cmd === 'createLink'){
      const url = prompt('Enter URL (include http(s)://):', 'https://');
      if(url) document.execCommand('createLink', false, url);
    } else if(cmd === 'formatBlock' && val){
      document.execCommand('formatBlock', false, val === 'H1' ? 'h1' : (val === 'H2' ? 'h2' : 'h3'));
    } else if(cmd === 'removeFormat'){
      document.execCommand('removeFormat', false, null);
    } else if(cmd === 'undo' || cmd === 'redo'){
      document.execCommand(cmd, false, null);
    } else {
      document.execCommand(cmd, false, val);
    }
    editorContent.focus();
  });
});

codeModeBtn.addEventListener('click', ()=>{
  codeMode = !codeMode;
  if(codeMode){
    codeArea.value = editorContent.innerHTML;
    editorArea.style.display = 'block';
    editorContent.style.display = 'none';
    codeArea.style.display = 'block';
    codeModeBtn.style.background = 'rgba(255,255,255,0.06)';
    codeArea.focus();
  } else {
    editorContent.innerHTML = codeArea.value;
    codeArea.style.display = 'none';
    editorContent.style.display = 'block';
    editorArea.style.display = 'block';
    codeModeBtn.style.background = '';
    editorContent.focus();
  }
});

/* Opening editor for a specific section from the page preview
   It opens the modal for the page and selects the tab/section to edit.
   pageId: string, tabId: string, sectionId: string
*/
function openEditorForSection(pageId, tabId, sectionId){
  if(!editMode) return alert('Enable editing first (top-right button).');
  const page = PAGES[pageId];
  if(!page) return;
  // deep clone the page into editorState.pageCopy to allow in-modal edits without persisting until Save
  const pageCopy = JSON.parse(JSON.stringify(page));
  editorState = {
    pageId,
    pageCopy,
    currentTabId: tabId || pageCopy.activeTabId || (pageCopy.tabs[0] && pageCopy.tabs[0].id),
    currentSectionId: sectionId || (pageCopy.tabs[0] && pageCopy.tabs[0].sections[0] && pageCopy.tabs[0].sections[0].id) || null,
    originalSectionHtml: null
  };
  // ensure every section has id/header/content/collapsed fields
  editorState.pageCopy.tabs.forEach(t=>{
    t.id = t.id || makeId('t');
    t.title = t.title || 'Untitled';
    t.sections = t.sections || [];
    t.sections.forEach(s=>{
      s.id = s.id || makeId('s');
      s.header = s.header || s.title || 'Untitled';
      s.content = s.content || s.html || '';
      if(typeof s.collapsed === 'undefined') s.collapsed = false;
    });
  });
  // set editor UI
  editorTitle.textContent = `Edit — ${editorState.pageCopy.title}`;
  editorMeta.textContent = `${editorState.pageCopy.category} · ${pageId}`;
  renderEditorTabsBar();
  renderActiveTabPane(true);
  // load selected section content into the editor content area
  loadSelectedSectionIntoEditor();

  // show modal
  editorModal.style.display = 'flex';
  // ensure editor area visible
  editorArea.style.display = 'block';
  codeMode = false;
  codeArea.style.display = 'none';
  editorContent.style.display = 'block';
  setTimeout(()=>editorContent.focus(),50);
}

/* Render tabs bar (buttons + rename/remove)
   --- PERMANENT FIX: robust, forces visibility, handles empty state, and scrolls active into view
*/
function renderEditorTabsBar(){
  if(!editorState) return;
  // ensure tabsBar exists and is visible
  if(!tabsBar){
    console.warn('renderEditorTabsBar: tabsBar element not found');
    return;
  }
  tabsBar.style.display = 'flex';
  tabsBar.innerHTML = '';

  const list = document.createElement('div');
  list.className = 'tabs-list';

  const tabs = (editorState.pageCopy && editorState.pageCopy.tabs) || [];

  if(tabs.length === 0){
    const placeholder = document.createElement('div');
    placeholder.className = 'small-muted';
    placeholder.textContent = '(no tabs)';
    list.appendChild(placeholder);
  } else {
    tabs.forEach(tab => {
      const btn = document.createElement('button');
      btn.className = 'tab-btn' + (tab.id === editorState.currentTabId ? ' active' : '');
      btn.dataset.tabId = tab.id;
      btn.innerHTML = '<span class="tab-title-text">' + escapeHtml(tab.title) + '</span>' +
                      '<span style="margin-left:8px;display:flex;gap:6px">' +
                        '<button class="tab-rename small" data-action="rename" title="Rename">✎</button>' +
                        '<button class="tab-remove small" data-action="remove" title="Remove">✕</button>' +
                      '</span>';

      // click to switch (but ignore internal small buttons)
      btn.addEventListener('click', function(e){
        if(e.target.closest('button') && e.target !== this) return;
        if(typeof switchEditorTab === 'function') switchEditorTab(tab.id);
      });

      // rename handler
      const renameBtn = btn.querySelector('[data-action="rename"]');
      if(renameBtn){
        renameBtn.addEventListener('click', function(ev){
          ev.stopPropagation();
          if(typeof initiateRenameTab === 'function') initiateRenameTab(tab.id);
        });
      }

      // remove handler
      const removeBtn = btn.querySelector('[data-action="remove"]');
      if(removeBtn){
        removeBtn.addEventListener('click', function(ev){
          ev.stopPropagation();
          if(typeof removeTab === 'function') removeTab(tab.id);
        });
      }

      list.appendChild(btn);
    });
  }

  tabsBar.appendChild(list);

  // scroll active into view
  setTimeout(() => {
    try{
      const active = tabsBar.querySelector('.tab-btn.active');
      if(active && typeof active.scrollIntoView === 'function'){
        active.scrollIntoView({behavior:'smooth', inline:'center', block:'nearest'});
      }
    }catch(e){ /* ignore */ }
    // helpful debug
    // console.log('renderEditorTabsBar: rendered', tabs.length, 'tabs, currentTabId=', editorState.currentTabId);
  }, 40);
}

/* Add tab (from toolbar) */
addTabBtn.addEventListener('click', ()=>{
  const title = (newTabTitleInput.value || '').trim() || 'New Tab';
  addTab(title, true);
  newTabTitleInput.value = '';
});
newTabTitleInput.addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ addTabBtn.click(); }});

function addTab(title='New Tab', openAfter=true){
  if(!editorState) return;
  const tid = makeId('t');
  const newTab = { id: tid, title: title||'Untitled', sections: [] };
  editorState.pageCopy.tabs.push(newTab);
  if(openAfter) editorState.currentTabId = tid;
  renderEditorTabsBar();
  renderActiveTabPane();
}

/* Rename tab inline */
function initiateRenameTab(tabId){
  const btn = tabsBar.querySelector(`.tab-btn[data-tab-id="${tabId}"]`);
  if(!btn) return;
  const titleSpan = btn.querySelector('.tab-title-text');
  const current = titleSpan.textContent;
  const input = document.createElement('input');
  input.className = 'tab-edit-input';
  input.value = current;
  titleSpan.replaceWith(input);
  input.focus();
  input.select();
  function finish(){
    const newTitle = (input.value || '').trim() || 'Untitled';
    const tab = editorState.pageCopy.tabs.find(t=>t.id===tabId);
    if(tab) tab.title = newTitle;
    renderEditorTabsBar();
    renderActiveTabPane();
  }
  input.addEventListener('blur', finish);
  input.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ input.blur(); } if(e.key==='Escape'){ input.value=current; input.blur(); }});
}

/* Remove a tab */
function removeTab(tabId){
  if(!editorState) return;
  if(!confirm('Remove this tab and all its sections?')) return;
  const idx = editorState.pageCopy.tabs.findIndex(t=>t.id===tabId);
  if(idx===-1) return;
  editorState.pageCopy.tabs.splice(idx,1);
  // update currentTabId
  if(editorState.currentTabId === tabId){
    editorState.currentTabId = editorState.pageCopy.tabs[0] ? editorState.pageCopy.tabs[0].id : null;
  }
  renderEditorTabsBar();
  renderActiveTabPane();
}

/* Switch tab with slide animation */
function switchEditorTab(tabId){
  if(!editorState) return;
  if(tabId === editorState.currentTabId) return;
  const tabs = editorState.pageCopy.tabs || [];
  const fromIndex = tabs.findIndex(t=>t.id===editorState.currentTabId);
  const toIndex = tabs.findIndex(t=>t.id===tabId);
  const direction = toIndex > fromIndex ? 'right' : 'left';
  animateTabSwitch(editorState.currentTabId, tabId, direction);
  editorState.currentTabId = tabId;
  renderEditorTabsBar();
}

/* Animation helper */
function animateTabSwitch(fromTabId, toTabId, direction='right'){
  const oldPane = tabsContainer.querySelector('.tab-pane.active');
  const newPane = createTabPane(toTabId);
  newPane.classList.add('entering');
  tabsContainer.appendChild(newPane);
  requestAnimationFrame(()=>{
    newPane.classList.add('active');
    if(oldPane){
      oldPane.classList.add('leaving');
      oldPane.classList.add(direction === 'left' ? 'left' : 'right');
    }
  });
  setTimeout(()=>{
    tabsContainer.querySelectorAll('.tab-pane').forEach(p => { if(p !== newPane) p.remove(); });
    newPane.classList.remove('entering');
    newPane.classList.add('active');
  }, 320);
}

/* Render active tab pane (non-animated) */
function renderActiveTabPane(forceEnter=false){
  if(!editorState) return;
  tabsContainer.innerHTML = '';
  if(!editorState.currentTabId && editorState.pageCopy.tabs.length) editorState.currentTabId = editorState.pageCopy.tabs[0].id;
  if(!editorState.currentTabId){
    tabsContainer.innerHTML = '<div class="tab-pane active"><p style="padding:12px">No tabs available.</p></div>';
    return;
  }
  const pane = createTabPane(editorState.currentTabId);
  if(forceEnter){
    pane.classList.add('entering');
    requestAnimationFrame(()=> pane.classList.add('active'));
    setTimeout(()=> pane.classList.remove('entering'), 320);
  } else pane.classList.add('active');
  tabsContainer.appendChild(pane);
}

/* Create tab pane DOM: list of sections + controls */
function createTabPane(tabId){
  const tab = editorState.pageCopy.tabs.find(t=>t.id===tabId);
  const pane = document.createElement('div');
  pane.className = 'tab-pane';
  pane.dataset.tabId = tabId;

  const header = document.createElement('div');
  header.style.display='flex';
  header.style.justifyContent='space-between';
  header.style.alignItems='center';
  header.style.marginBottom='8px';
  header.innerHTML = `<div style="font-weight:700">${escapeHtml(tab.title)}</div>
    <div style="display:flex;gap:8px">
      <button class="btn" id="addSectionBtn">+ Section</button>
      <button class="btn ghost" id="renameTabBtn">Rename Tab</button>
    </div>`;
  pane.appendChild(header);

  // sections list container
  const list = document.createElement('div');
  list.className = 'tab-sections';
  tab.sections.forEach(sec=>{
    const secNode = createSectionEditorNode(sec, tabId);
    list.appendChild(secNode);
  });
  pane.appendChild(list);

  // events
  header.querySelector('#addSectionBtn').addEventListener('click', ()=>{
    const newSec = { id: makeId('s'), header: 'New Section', content: '<p>Edit this section</p>', collapsed:false };
    tab.sections.push(newSec);
    renderActiveTabPane();
    // make new section selected
    editorState.currentSectionId = newSec.id;
    loadSelectedSectionIntoEditor();
  });
  header.querySelector('#renameTabBtn').addEventListener('click', ()=>{
    initiateRenameTab(tabId);
  });

  return pane;
}

/* Create section editor node shown in the pane.
   Clicking 'Edit' selects it (loads into WYSIWYG editor below).
*/
function createSectionEditorNode(section, tabId){
  const wrap = document.createElement('div');
  wrap.className = 'section-editor';
  wrap.dataset.sectionId = section.id;

  const controls = document.createElement('div');
  controls.className = 'controls';
  controls.innerHTML = `
    <input class="section-title-input" value="${escapeHtml(section.header || section.title || 'Untitled')}" />
    <label class="small">Collapsed <input type="checkbox" class="collapse-checkbox" ${section.collapsed ? 'checked' : ''} /></label>
    <label class="small">Move to:
      <select class="move-select"></select>
    </label>
    <div style="margin-left:auto;display:flex;gap:6px">
      <button class="btn small select-section">Edit</button>
      <button class="btn small remove-section">Remove</button>
    </div>`;
  wrap.appendChild(controls);

  // populate move-select
  const moveSelect = controls.querySelector('.move-select');
  editorState.pageCopy.tabs.forEach(t=>{
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.title;
    if(t.id === tabId) opt.selected = true;
    moveSelect.appendChild(opt);
  });

  // preview body (collapsed)
  const preview = document.createElement('div');
  preview.className = 'editor-body';
  preview.innerHTML = section.content || '';
  wrap.appendChild(preview);

  // event listeners
  controls.querySelector('.section-title-input').addEventListener('input', (e)=>{
    section.header = e.target.value;
    // reflect change in UI (no need to persist until Save)
  });
  controls.querySelector('.collapse-checkbox').addEventListener('change', (e)=>{
    section.collapsed = e.target.checked;
  });
  controls.querySelector('.remove-section').addEventListener('click', ()=>{
    if(!confirm('Remove this section?')) return;
    const parentTab = editorState.pageCopy.tabs.find(t=>t.sections.some(s=>s.id===section.id));
    if(!parentTab) return;
    parentTab.sections = parentTab.sections.filter(s=>s.id !== section.id);
    // clear selection if removed section was selected
    if(editorState.currentSectionId === section.id) editorState.currentSectionId = null;
    renderEditorTabsBar();
    renderActiveTabPane();
    loadSelectedSectionIntoEditor();
  });
  controls.querySelector('.select-section').addEventListener('click', ()=>{
    // select and load into editor
    editorState.currentTabId = tabId;
    editorState.currentSectionId = section.id;
    renderEditorTabsBar();
    renderActiveTabPane();
    loadSelectedSectionIntoEditor();
  });
  moveSelect.addEventListener('change', (e)=>{
    const destTabId = e.target.value;
    if(destTabId === tabId) return;
    const srcTab = editorState.pageCopy.tabs.find(t=>t.sections.some(s=>s.id===section.id));
    const destTab = editorState.pageCopy.tabs.find(t=>t.id===destTabId);
    if(!srcTab || !destTab) return;
    srcTab.sections = srcTab.sections.filter(s=>s.id!==section.id);
    destTab.sections.push(section);
    editorState.currentTabId = destTabId;
    renderEditorTabsBar();
    renderActiveTabPane();
    loadSelectedSectionIntoEditor();
  });

  return wrap;
}

/* Load currently selected section into the bottom WYSIWYG editor */
function loadSelectedSectionIntoEditor(){
  if(!editorState) return;
  // find selected section in pageCopy
  let selected = null;
  for(const t of editorState.pageCopy.tabs){
    const s = t.sections.find(s=>s.id === editorState.currentSectionId);
    if(s){ selected = s; break; }
  }
  // if not found, attempt to select first section in current tab
  if(!selected){
    const tab = editorState.pageCopy.tabs.find(t=>t.id===editorState.currentTabId) || editorState.pageCopy.tabs[0];
    if(tab && tab.sections[0]){ selected = tab.sections[0]; editorState.currentSectionId = tab.sections[0].id; }
  }
  if(selected){
    editorState.originalSectionHtml = selected.content;
    // show editor area and populate
    editorArea.style.display = 'block';
    editorContent.innerHTML = selected.content || '';
    codeArea.value = selected.content || '';
    codeMode = false;
    editorContent.style.display = 'block';
    codeArea.style.display = 'none';
    // highlight selection in pane (optional)
    // focus editor
    setTimeout(()=> editorContent.focus(), 40);
  } else {
    // no section to edit
    editorArea.style.display = 'none';
  }
}

/* Save currently loaded section back into editorState.pageCopy */
function saveCurrentSectionFromEditor(){
  if(!editorState) return;
  // find section
  let sec = null;
  for(const t of editorState.pageCopy.tabs){
    const s = t.sections.find(s=>s.id === editorState.currentSectionId);
    if(s){ sec = s; break; }
  }
  if(!sec) return;
  const newHtml = codeMode ? codeArea.value : editorContent.innerHTML;
  sec.content = newHtml;
  editorState.originalSectionHtml = newHtml;
}

/* Save entire page (tabs + sections) into main PAGES and persist */
editorSaveBtn.addEventListener('click', ()=>{
  if(!editorState) return;
  // save current editing section first
  saveCurrentSectionFromEditor();
  // strip any temporary props and write back
  PAGES[editorState.pageId] = JSON.parse(JSON.stringify(editorState.pageCopy));
  // ensure activeTabId updated
  if(!PAGES[editorState.pageId].activeTabId || !PAGES[editorState.pageId].tabs.find(t=>t.id===PAGES[editorState.pageId].activeTabId)){
    PAGES[editorState.pageId].activeTabId = PAGES[editorState.pageId].tabs[0] ? PAGES[editorState.pageId].tabs[0].id : null;
  }
  savePagesToStorage(PAGES);
  // update preview if currently viewing page
  if(currentPageId === editorState.pageId) loadPage(currentPageId);
  alert('Page saved.');
});

/* Save & Close */
editorSaveAndCloseBtn.addEventListener('click', ()=>{
  editorSaveBtn.click();
  closeEditorModal();
});

/* Close without saving changes written in modal (just discard pageCopy) */
editorCloseNoSaveBtn.addEventListener('click', ()=>{
  if(confirm('Close without saving changes? All unsaved changes in the modal will be lost.')) closeEditorModal();
});
editorCloseBtn.addEventListener('click', closeEditorModal);

function closeEditorModal(){
  editorState = null;
  editorModal.style.display = 'none';
  editorArea.style.display = 'none';
  // re-render page to ensure UI consistent
  if(currentPageId) loadPage(currentPageId);
}

/* Revert currently loaded section content to original as it was when modal opened/when section was selected */
editorRevertBtn.addEventListener('click', ()=>{
  if(!editorState) return;
  if(editorState.originalSectionHtml !== null){
    editorContent.innerHTML = editorState.originalSectionHtml;
    codeArea.value = editorState.originalSectionHtml;
    codeMode = false;
    codeArea.style.display = 'none';
    editorContent.style.display = 'block';
    alert('Reverted section content to last loaded value in modal.');
  }
});

/* Keyboard: Esc closes modal (without saving) */
document.addEventListener('keydown', (e)=>{
  if(e.key === 'Escape' && editorModal.style.display === 'flex') {
    // close only if not currently in a text input
    const active = document.activeElement;
    if(active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
    closeEditorModal();
  }
});

/* ===========================
   Init app
   =========================== */
function init(){
  migratePagesShape(PAGES);
  buildSidebar();

  // Attach delegated sidebar click handler so links always work.
  attachSidebarDelegation();

  const firstPage = Object.keys(PAGES)[0];
  if(firstPage) loadPage(firstPage);
  updateEditorToggleUI();

  // animate sidebar links in
  setTimeout(()=>{
    document.querySelectorAll('#sidebar a').forEach((el,i)=>{
      setTimeout(()=>{el.style.opacity='1'; el.style.transform='translateX(0)';}, i*90);
    });
  },200);
}

document.addEventListener('DOMContentLoaded', init);

/* Speaker toggle (kept simple) */
let musicPlaying = true;
document.getElementById('speakerBtn').addEventListener('click', ()=>{
  const m = document.getElementById('bgMusic');
  musicPlaying = !musicPlaying;
  if(musicPlaying) m.play(); else m.pause();
});

/* Developer helper (addPage) retained and adjusted */
window.addPage = function(id, pageObj){
  if(!id || !pageObj) return;
  // accept both legacy shape and tabs shape
  PAGES[id] = pageObj;
  migratePagesShape(PAGES);
  savePagesToStorage(PAGES);
  buildSidebar();
  attachSidebarDelegation();
};