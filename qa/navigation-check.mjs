import {createServer} from 'vite';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('.export-qa',{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:0,strictPort:false}});await server.listen();
const browser=await chromium.launch(process.env.QA_BROWSER?{executablePath:process.env.QA_BROWSER}:{});
const origin=server.resolvedUrls.local[0];const errors=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await context.addInitScript(()=>localStorage.setItem('touchstonecv-usage-guide',JSON.stringify({version:1,decision:'skipped'})));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);
 await page.getByRole('heading',{name:'简历工作台',exact:true}).waitFor();
 const fixture=await page.evaluate(async()=>{
  const {useApp}=await import('/src/lib/store.ts');const {buildSampleResume}=await import('/src/lib/samples.ts');const data=buildSampleResume('frontend','experienced');const work=data.sections.find(s=>s.type==='work_experience');
  work.blocks=Array.from({length:9},(_,i)=>({...structuredClone(work.blocks[0]),block_id:'nav-entry-'+i,title:'定位测试经历 '+i,order:i}));
  work.blocks.push({...structuredClone(work.blocks[0]),block_id:'nav-hidden',title:'隐藏经历',visible:false,order:10});
  const id=useApp.getState().createResume(data,'定位联动验证');return {id,section:work.section_id,basic:data.sections.find(s=>s.type==='basic_info').section_id};
 });
 await page.goto(origin+'#/editor/'+fixture.id);await page.getByRole('tab',{name:'内容与预览',exact:true}).click();
 await page.locator('[data-testid="live-preview"] [data-preview-page="2"]').waitFor();
 const original=await page.evaluate(async id=>{const {useApp}=await import('/src/lib/store.ts');return JSON.stringify(useApp.getState().resumes.find(r=>r.id===id));},fixture.id);
 const entry=page.locator('.editor-content [data-block-id="nav-entry-7"]');
 const field=entry.locator('input').first();await field.focus();
 const highlighted=page.locator('[data-testid="live-preview"] [data-preview-location="true"]');await highlighted.waitFor();
 assert.equal(await highlighted.getAttribute('data-resume-entry'),'nav-entry-7');
 const locatedPage=await highlighted.evaluate(el=>el.closest('[data-preview-page]').dataset.previewPage);assert(Number(locatedPage)>1);
 const focusPreserved=await field.evaluate(el=>el===document.activeElement);assert(focusPreserved);
 const panes=()=>page.evaluate(()=>({edit:document.querySelector('.editor-content').scrollTop,preview:document.querySelector('.editor-preview').scrollTop,page:document.scrollingElement.scrollTop}));
 const beforeTyping=await panes();assert(beforeTyping.preview>0);assert.equal(beforeTyping.page,0);
 // Ordinary typing must not generate another positioning request or reset the pane.
 await field.press('ArrowRight');assert.deepEqual(await panes(),beforeTyping);
 await highlighted.waitFor({state:'hidden',timeout:4000});

 // Menu actions on another card must not move the preview or change the active item.
 const other=page.locator('.editor-content [data-block-id="nav-entry-0"]');
 const menuScroll=(await panes()).preview;
 await other.getByRole('button',{name:/更多操作/}).click();
 assert.equal((await panes()).preview,menuScroll);
 assert.equal(await page.locator('[data-preview-current]').getAttribute('data-resume-entry'),'nav-entry-7');
 await page.keyboard.press('Escape');
 await page.locator('.editor-preview').evaluate(el=>el.scrollTop=0);
 await field.focus();await entry.locator('input').nth(1).focus();await field.click();
 assert.equal((await panes()).preview,0);
 await page.getByRole('button',{name:'定位预览',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.editor-preview').scrollTop>0);
 // A different entry already inside the viewport should get a marker, without movement.
 await page.locator('.editor-preview').evaluate(el=>{
  const a=el.querySelector('[data-preview-page] [data-resume-entry="nav-entry-7"]');
  el.scrollTop+=a.getBoundingClientRect().top-el.getBoundingClientRect().top-100;
 });
 const visibleScroll=(await panes()).preview;
 const field8=page.locator('.editor-content [data-block-id="nav-entry-8"] input').first();
 await field8.focus();await page.waitForFunction(()=>document.querySelector('[data-resume-entry="nav-entry-8"][data-preview-current]'));
 assert(Math.abs((await panes()).preview-visibleScroll)<1);
 await field.focus();
 // Native document headings remain headings; controls use a single roving Tab stop.
 assert(await page.locator('[data-testid="live-preview"]').getByRole('heading',{name:'工作经历',exact:true}).count()>0);
 assert.equal(await page.locator('[data-preview-page] [data-resume-entry][role=button]').count(),0);
 assert.equal(await page.locator('[data-preview-edit][tabindex="0"]').count(),1);
 const roving=page.locator('[data-preview-edit][tabindex="0"]');
 await roving.focus();const editBeforeKeys=(await panes()).edit;
 await roving.press('ArrowDown');
 assert.equal(await page.locator('[data-preview-edit]:focus').count(),1);
 assert.equal((await panes()).edit,editBeforeKeys);
 assert.equal(await page.locator('[data-preview-edit][tabindex="0"]').count(),1);
 const settleVisible=async id=>page.waitForFunction(id=>{
  const pane=document.querySelector('.editor-preview');const el=pane.querySelector('[data-preview-page] [data-resume-entry="'+id+'"]');const r=el.getBoundingClientRect();const b=pane.getBoundingClientRect();const toolbar=pane.querySelector('[data-preview-toolbar]').getBoundingClientRect();
  return r.top>=toolbar.bottom-1&&r.bottom<=b.bottom-10;
 },id);
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.locator('.editor-preview').evaluate(el=>el.scrollTop=0);
 await page.getByRole('button',{name:'定位预览',exact:true}).click();await settleVisible('nav-entry-7');
 await other.locator('input').first().focus();await field8.focus();await settleVisible('nav-entry-8');
 assert.equal(await page.locator('[data-preview-current]').getAttribute('data-resume-entry'),'nav-entry-8');
 await page.locator('[data-testid="live-preview"]').getByRole('button',{name:'75%',exact:true}).click();
 await page.locator('.editor-preview').evaluate(el=>el.scrollTop=0);
 await page.getByRole('button',{name:'定位预览',exact:true}).click();await settleVisible('nav-entry-8');
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.locator('[data-testid="live-preview"]').getByRole('button',{name:'适应窗口',exact:true}).click();
 await field.focus();

 // Collapsed entries must expand when activated from the preview, without focusing an input.
 await entry.getByRole('button',{name:'折叠',exact:true}).click();await field.waitFor({state:'hidden'});
 const target=page.locator('[data-testid="live-preview"] [data-preview-page] [data-resume-entry="nav-entry-7"]');
 const editControl=target.locator('button[data-preview-edit]');await editControl.focus();const beforeReverse=await panes();await editControl.press('Enter');
 await entry.locator('input').first().waitFor({state:'visible'});
 await page.waitForFunction(()=>document.querySelector('[data-block-id="nav-entry-7"]').hasAttribute('data-editor-location'));
 assert.equal(await entry.evaluate(el=>el===document.activeElement),true);
 assert.equal(await page.getByRole('tab',{name:'内容与预览',exact:true}).getAttribute('aria-selected'),'true');
 assert.equal((await panes()).preview,beforeReverse.preview);
 assert.equal(await page.evaluate(()=>document.activeElement.matches('input,textarea,[contenteditable=true]')),false);
 await page.screenshot({path:'.export-qa/click-preview-navigation.png'});
 // Section and contact header mapping, plus a truthful message for hidden entries.
 const sectionHeading=page.locator('.editor-content [data-section-id="'+fixture.section+'"] h3').first();await sectionHeading.click();
 await page.waitForFunction(()=>document.querySelector('[data-testid="live-preview"] h2[data-preview-location]'));
 const basic=page.locator('.editor-content [data-section-id="'+fixture.basic+'"] input').first();await basic.focus();
 await page.waitForFunction(()=>document.querySelector('[data-testid="live-preview"] header[data-preview-location]'));
 await page.locator('.editor-content [data-block-id="nav-hidden"] input').first().focus();
 await page.getByRole('status').filter({hasText:'该内容已隐藏或为空'}).waitFor();
 assert.equal(await page.locator('[data-testid="live-preview"] [data-resume-entry="nav-hidden"]').count(),0);
 const after=await page.evaluate(async id=>{const {useApp}=await import('/src/lib/store.ts');return JSON.stringify(useApp.getState().resumes.find(r=>r.id===id));},fixture.id);assert.equal(after,original);
 // Typing can repaginate the preview, but must not issue another scroll request.
 await field.focus();await page.locator('[data-testid="live-preview"] [data-preview-location]').waitFor();
 const typingBefore=await panes();const originalTitle=await field.inputValue();
 await field.fill(originalTitle+' 编辑验证');
 await page.waitForFunction(()=>document.querySelector('[data-testid="live-preview"] [data-preview-page] [data-resume-entry="nav-entry-7"]').textContent.includes('编辑验证'));
 assert.equal((await panes()).preview,typingBefore.preview);assert.equal(await field.evaluate(el=>el===document.activeElement),true);
 const oldPage=await page.locator('[data-preview-current]').evaluate(el=>el.closest('[data-preview-page]').dataset.previewPage);
 await page.evaluate(async id=>{const {useApp}=await import('/src/lib/store.ts');const state=useApp.getState();const resume=state.resumes.find(r=>r.id===id);const section=resume.data.sections.find(s=>s.type==='work_experience');state.patchBlock(id,section.section_id,'nav-entry-0',{description:'补充内容用于验证重新分页后对应条目的位置。'.repeat(100)});},fixture.id);
 await page.waitForFunction(old=>{const el=document.querySelector('[data-preview-current][data-resume-entry="nav-entry-7"]');return el&&el.closest('[data-preview-page]').dataset.previewPage!==old;},oldPage);
 // An oversized target wholly below the viewport still needs to be brought into view.
 await page.evaluate(async id=>{const {useApp}=await import('/src/lib/store.ts');const state=useApp.getState();const section=state.resumes.find(r=>r.id===id).data.sections.find(s=>s.type==='work_experience');state.patchBlock(id,section.section_id,'nav-entry-0',{description:'超长条目仍需能够定位开头。'.repeat(250)});},fixture.id);
 await other.locator('input').first().focus();
 await page.waitForFunction(()=>{const pane=document.querySelector('.editor-preview');const target=pane.querySelector('[data-preview-page] [data-resume-entry="nav-entry-0"][data-preview-current]');return target&&target.getBoundingClientRect().height>pane.clientHeight;});
 await page.locator('.editor-preview').evaluate(el=>el.scrollTop=0);
 await page.getByRole('button',{name:'定位预览',exact:true}).click();
 await page.waitForFunction(()=>{const pane=document.querySelector('.editor-preview');const target=pane.querySelector('[data-preview-page] [data-resume-entry="nav-entry-0"]');const top=target.getBoundingClientRect().top;const toolbar=pane.querySelector('[data-preview-toolbar]').getBoundingClientRect();return top>=toolbar.bottom-1&&top<toolbar.bottom+20;});
 // Mobile preview activation returns to content rather than trying to force a split screen.
 await page.setViewportSize({width:375,height:850});await page.getByRole('tab',{name:'仅预览',exact:true}).click();
 const mobileTarget=page.locator('[data-testid="live-preview"] [data-preview-page] [data-resume-entry="nav-entry-1"]');await mobileTarget.click();
 await page.getByRole('tab',{name:'写内容',exact:true}).waitFor();assert.equal(await page.getByRole('tab',{name:'写内容',exact:true}).getAttribute('aria-selected'),'true');
 await page.locator('.editor-content [data-block-id="nav-entry-1"][data-editor-location]').waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),375);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({laterPage:locatedPage,editorFocusPreserved:true,previewScrollIndependent:true,menusDoNotNavigate:true,sameEntryDoesNotNavigate:true,visibleTargetDoesNotScroll:true,semanticHeadings:true,markerSurvivesRepagination:true,rovingKeyboard:true,singleTabStop:true,smoothScrollAndZoom:true,oversizedTargetCanBeLocated:true,typingDoesNotRescroll:true,keyboardActivation:true,collapsedEntryExpanded:true,hiddenEntryNotRevealed:true,sourceUnchanged:true,mobile:true,errors},null,2));
}finally{await browser.close();await server.close();}
