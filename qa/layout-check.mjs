import {createServer} from 'vite';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('.export-qa',{recursive:true});
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
const server=await createServer({server:{host:'127.0.0.1',port:0,strictPort:false}});await server.listen();
const origin=server.resolvedUrls.local[0];
const browser=await chromium.launch(process.env.QA_BROWSER ? {executablePath:process.env.QA_BROWSER} : {});
const errors=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.addInitScript(()=>localStorage.setItem('touchstonecv-usage-guide',JSON.stringify({version:1,decision:'skipped'})));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);
 await page.getByRole('heading',{name:'简历工作台',exact:true}).waitFor();
 const fixture=await page.evaluate(async()=>{
  const {useApp}=await import('/src/lib/store.ts');const {buildSampleResume}=await import('/src/lib/samples.ts');
  const {createResumeMeasurer}=await import('/src/components/resume-measure.tsx');
  const app=useApp.getState();const id=app.createResume(buildSampleResume('frontend','experienced'),'篇幅验证');
  const original=useApp.getState().resumes.find(r=>r.id===id);
  const work=original.data.sections.find(s=>s.type==='work_experience');
  const m=createResumeMeasurer(new AbortController().signal);
  let chosen;
  const densityChecks=[];
  try{
   for(const template of ['modern_single_column','classic_ats','academic_photo']){
    const r={...original,template_id:template,theme:{...original.theme,font_size:14,density:'loose'}};
    const loose=await m.measure(r);
    const compact=await m.measure({...r,theme:{...r.theme,density:'compact'}});
    if(compact.contentHeight>=loose.contentHeight*.95)throw new Error(template+' density did not affect real layout');
    densityChecks.push({template,loose:loose.contentHeight,compact:compact.contentHeight});
   }
   for(let count=3;count<=8;count++){
    const r=structuredClone(original);const section=r.data.sections.find(s=>s.type==='work_experience');
    section.blocks=Array.from({length:count},(_,i)=>({...structuredClone(work.blocks[i%work.blocks.length]),block_id:'layout-work-'+i,order:i}));
    r.theme={...r.theme,font_size:16,density:'loose'};
    const loose=await m.measure(r),compact=await m.measure({...r,theme:{...r.theme,font_size:14,density:'compact',header_layout:'row'}});
    if(loose.pages.length>2&&compact.pages.length===2&&!compact.pages.some(p=>p.oversized)){
     chosen={r,loose:{pages:loose.pages.length,height:loose.contentHeight},compact:{pages:compact.pages.length,height:compact.contentHeight}};break;
    }
   }
  }finally{m.dispose();}
  if(!chosen)throw new Error('Could not construct a meaningful two-page fixture');
  useApp.setState(s=>({resumes:s.resumes.map(r=>r.id===id?chosen.r:r)}));
  return {id,before:JSON.stringify(chosen.r),loose:chosen.loose,compact:chosen.compact,densityChecks};
 });
 assert(fixture.compact.height<fixture.loose.height*.9);
 await page.goto(origin+'#/editor/'+fixture.id);await page.getByRole('button',{name:'导出',exact:true}).click();
 await page.getByRole('heading',{name:'检查并导出',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'切换紧凑布局',exact:true}).count(),0);
 await page.getByRole('button',{name:'调整篇幅',exact:true}).click();
 await page.getByRole('heading',{name:'检查并导出',exact:true}).waitFor({state:'hidden'});
 await page.getByRole('heading',{name:'智能篇幅调整',exact:true}).waitFor();
 const afterEntry=await page.evaluate(async id=>{const {useApp}=await import('/src/lib/store.ts');return JSON.stringify(useApp.getState().resumes.find(r=>r.id===id));},fixture.id);
 assert.equal(afterEntry,fixture.before);
 await page.getByText('正在测量实际版式…',{exact:true}).waitFor({state:'hidden',timeout:60000});
 assert.equal(await page.getByRole('button',{name:'2 页',exact:true}).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'2 页',exact:true}).click();
 await page.getByText('正在测量实际版式…',{exact:true}).waitFor({state:'hidden',timeout:60000});
 const createTwo=page.getByRole('button',{name:/创建 2 页副本/});
 await createTwo.waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.includes('创建 2 页副本')&&!b.disabled));
 await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:'.export-qa/smart-two-page.png'});
 await createTwo.click();await page.getByRole('heading',{name:'智能篇幅调整',exact:true}).waitFor({state:'hidden'});
 const two=await page.evaluate(async({id,before})=>{
  const {useApp}=await import('/src/lib/store.ts');const s=useApp.getState();const copy=s.resumes.find(r=>r.id!==id&&r.title.endsWith('2页版'));
  return {sourceUnchanged:JSON.stringify(s.resumes.find(r=>r.id===id))===before,copy,versions:s.snapshots.filter(x=>x.resume_id===copy.id).length};
 },fixture);
 assert(two.sourceUnchanged);assert(two.versions>=2);assert.deepEqual(two.copy.data,JSON.parse(fixture.before).data);
 await page.goto(origin+'#/editor/'+fixture.id);await page.getByRole('button',{name:'篇幅调整',exact:true}).click();
 await page.getByText('正在测量实际版式…',{exact:true}).waitFor({state:'hidden',timeout:60000});
 await page.getByRole('button',{name:'1 页',exact:true}).click();
 await page.getByText('正在测量实际版式…',{exact:true}).waitFor({state:'hidden',timeout:60000});
 const recommended=page.getByRole('radio',{name:/精简部分内容/});
 if(await recommended.isEnabled())await recommended.check();
 // Locking a suggested exclusion restores it, and the checkbox cannot exclude it.
 const excluded=page.locator('[data-fit-entry] input[type=checkbox]:not(:checked)').first();
 assert(await excluded.count()>0);
 const lockedId=await excluded.evaluate(el=>el.closest('[data-fit-entry]').dataset.fitEntry);
 const lockedRow=page.locator('[data-fit-entry="'+lockedId+'"]');
 await lockedRow.getByRole('button').click();
 await page.getByText('正在测量实际版式…',{exact:true}).waitFor({state:'hidden',timeout:60000});
 assert(await lockedRow.locator('input').isChecked());assert(await lockedRow.locator('input').isDisabled());
 const contentSummary=page.locator('summary').filter({hasText:'纳入此版本'});
 if(!await contentSummary.evaluate(el=>el.parentElement.open))await contentSummary.click();
 await lockedRow.getByRole('button').click();
 await page.getByText('正在测量实际版式…',{exact:true}).waitFor({state:'hidden',timeout:60000});
 await recommended.check();
 const createOne=page.getByRole('button',{name:/创建 1 页副本/});
 await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.includes('创建 1 页副本')&&!b.disabled));
 const originalPageCount=JSON.parse(fixture.before).data.sections.flatMap(s=>s.blocks).filter(b=>b.visible).length;
 await page.getByRole('button',{name:'查看原稿',exact:true}).click();
 await page.waitForFunction(count=>document.querySelectorAll('[data-preview-page] [data-resume-entry]').length>=count-1,originalPageCount);
 assert.equal(await page.getByRole('button',{name:'查看原稿',exact:true}).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'调整方案',exact:true}).click();
 await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.includes('创建 1 页副本')&&!b.disabled));
 await page.screenshot({path:'.export-qa/smart-one-page.png'});
 await createOne.click();await page.getByRole('heading',{name:'智能篇幅调整',exact:true}).waitFor({state:'hidden'});
 const one=await page.evaluate(async({id,before})=>{
  const {useApp}=await import('/src/lib/store.ts');const s=useApp.getState();const copy=s.resumes.find(r=>r.id!==id&&r.title.endsWith('1页版'));
  return {sourceUnchanged:JSON.stringify(s.resumes.find(r=>r.id===id))===before,copy};
 },fixture);
 assert(one.sourceUnchanged);
 const source=JSON.parse(fixture.before);for(const s of one.copy.data.sections)for(const b of s.blocks){const original=source.data.sections.find(x=>x.section_id===s.section_id).blocks.find(x=>x.block_id===b.block_id);assert.deepEqual({...b,visible:original.visible},original);}
 for(const [name,resume,expected] of [['one',one.copy,1],['two',two.copy,2]]){
  const print=await context.newPage();await print.goto(origin);await print.getByRole('heading',{name:'简历工作台',exact:true}).waitFor();
  const result=await print.evaluate(async r=>{
   const {createResumeMeasurer}=await import('/src/components/resume-measure.tsx');const m=createResumeMeasurer(new AbortController().signal);
   try{
    const measured=await m.measure(r);const html=[];
    for(const p of measured.pages){await m.measure(p.resume);html.push(document.querySelector('body > [aria-hidden=true] .resume-sheet-wrap').outerHTML);}
    document.body.innerHTML=html.join('');const style=document.createElement('style');style.textContent='@page{size:A4;margin:0}html,body{margin:0!important;padding:0!important} .resume-sheet-wrap{width:210mm!important;min-height:297mm!important;break-after:page}.resume-sheet-wrap:last-child{break-after:auto}.resume-sheet-wrap>div{min-height:297mm!important}';document.head.append(style);
    return {pages:measured.pages.length,oversized:measured.pages.some(p=>p.oversized)};
   }finally{m.dispose();}
  },resume);
  assert.equal(result.pages,expected);assert(!result.oversized);await print.evaluate(()=>document.fonts.ready);
  const bytes=await print.pdf({path:'.export-qa/smart-'+name+'.pdf',format:'A4',printBackground:true});
  const pdf=await getDocument({data:new Uint8Array(bytes),useSystemFonts:true}).promise;assert.equal(pdf.numPages,expected);await pdf.destroy();await print.close();
 }
 // Already fitting originals finish without producing duplicate resumes or snapshots.
 const small=await page.evaluate(async()=>{const {useApp}=await import('/src/lib/store.ts');const {buildSampleResume}=await import('/src/lib/samples.ts');const data=buildSampleResume('frontend','experienced');data.sections=data.sections.filter(s=>['basic_info','work_experience'].includes(s.type));data.sections.find(s=>s.type==='work_experience').blocks=data.sections.find(s=>s.type==='work_experience').blocks.slice(0,1);const id=useApp.getState().createResume(data,'无需调整验证');return {id,count:useApp.getState().resumes.length,snapshots:useApp.getState().snapshots.length};});
 await page.goto(origin+'#/editor/'+small.id);await page.getByRole('button',{name:'篇幅调整',exact:true}).click();
 await page.getByRole('button',{name:'完成',exact:true}).waitFor({timeout:60000});
 assert.equal(await page.getByRole('button',{name:'1 页',exact:true}).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'完成',exact:true}).click();
 const smallCounts=await page.evaluate(async()=>{const {useApp}=await import('/src/lib/store.ts');return {count:useApp.getState().resumes.length,snapshots:useApp.getState().snapshots.length};});
 assert.equal(smallCounts.count,small.count);assert.equal(smallCounts.snapshots,small.snapshots);
 const huge=await page.evaluate(async()=>{const {useApp}=await import('/src/lib/store.ts');const {buildSampleResume}=await import('/src/lib/samples.ts');const data=buildSampleResume('frontend','experienced');data.sections=data.sections.filter(s=>['basic_info','work_experience'].includes(s.type));const w=data.sections.find(s=>s.type==='work_experience');w.blocks=w.blocks.slice(0,1);w.blocks[0].bullets=Array.from({length:180},(_,i)=>'真实长段落 '+i+'：负责系统开发与改进，保留事实和成果。');return useApp.getState().createResume(data,'超长条目验证');});
 await page.goto(origin+'#/editor/'+huge);await page.getByRole('button',{name:'篇幅调整',exact:true}).click();await page.getByText('正在测量实际版式…',{exact:true}).waitFor({state:'hidden',timeout:60000});
 await page.getByRole('button',{name:'1 页',exact:true}).click();await page.getByText('正在测量实际版式…',{exact:true}).waitFor({state:'hidden',timeout:60000});assert(await page.getByRole('button',{name:/创建 1 页副本/}).isDisabled());
 await page.getByRole('button',{name:'2 页',exact:true}).click();await page.getByText('正在测量实际版式…',{exact:true}).waitFor({state:'hidden',timeout:60000});assert(await page.getByRole('button',{name:/创建 2 页副本/}).isDisabled());
 await page.setViewportSize({width:375,height:850});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),375);
 await page.screenshot({path:'.export-qa/smart-layout-mobile.png'});
 await page.getByRole('button',{name:'前往编辑',exact:true}).click();
 await page.getByRole('heading',{name:'智能篇幅调整',exact:true}).waitFor({state:'hidden'});
 await page.locator('.editor-content [data-editor-location]').waitFor();
 assert.deepEqual(errors,[]);console.log(JSON.stringify({fixture:{loose:fixture.loose,compact:fixture.compact,densityChecks:fixture.densityChecks},exportEntryDoesNotMutate:true,onePage:true,twoPages:true,defaultTarget:true,locksRestoreAndProtect:true,originalComparison:true,noOpCreatesNothing:true,originalPreserved:true,factsPreserved:true,pdfPages:[1,2],oversizedBlocked:true,editOversizedEntry:true,mobileWidth:375,errors},null,2));
}finally{await browser.close();await server.close();}
