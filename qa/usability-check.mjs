import { createServer } from 'vite';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('.export-qa', { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 0, strictPort: false } });
await server.listen();
const browser = await chromium.launch(process.env.QA_BROWSER ? { executablePath: process.env.QA_BROWSER } : {});
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce' });
  await context.addInitScript(() => localStorage.setItem('touchstonecv-usage-guide', JSON.stringify({ version: 1, decision: 'skipped' })));
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  const origin = server.resolvedUrls.local[0];
  await page.goto(origin);
  await page.getByRole('heading', { name: '简历工作台', exact: true }).waitFor();
  await page.getByRole('button', {name:'投递记录',exact:true}).click();
  await page.getByRole('heading', {name:'记录第一次投递',exact:true}).waitFor();
  assert.equal(await page.getByText('累计已投递', {exact:true}).count(),0);
  await page.screenshot({path:'.export-qa/usability-empty-applications.png'});
  await page.getByRole('button', {name:'工作台',exact:true}).click();
  const fixture = await page.evaluate(async () => {
    const { useApp } = await import('/src/lib/store.ts');
    const { buildSampleResume } = await import('/src/lib/samples.ts');
    const source = useApp.getState().createResume(buildSampleResume('ai', 'experienced'), '审查回归主简历');
    const id = useApp.getState().createJobVersion(source, '回归示例公司', 'AI 应用工程师', 'AI 应用工程师。负责企业 RAG 知识库和 Python 服务。要求具备 LangChain、向量数据库及 vLLM 部署经验。能够说明项目效果。');
    const resume = useApp.getState().resumes.find(r => r.id === id);
    return { id, source, before: JSON.stringify(resume) };
  });
  await page.goto(origin + '#/home');
  await page.getByRole('button', { name: '打开简历：回归示例公司 · AI 应用工程师', exact: true }).waitFor();
  assert.equal(await page.locator('.resume-thumbnail:visible').count(), 0);
  assert.equal(await page.getByRole('region',{name:'简历组：审查回归主简历'}).getByRole('listitem').count(),2);
  assert(!(await page.getByRole('textbox',{name:'搜索简历',exact:true}).isVisible()));
  await page.getByRole('button',{name:'筛选',exact:true}).click();
  await page.getByRole('textbox',{name:'搜索简历',exact:true}).fill('不存在的公司');
  await page.getByRole('button',{name:'清除筛选',exact:true}).click();
  await page.getByRole('button',{name:'打开简历：审查回归主简历',exact:true}).click();
  assert.equal(await page.getByRole('tab',{name:'内容与预览',exact:true}).getAttribute('aria-selected'),'true');
  assert(!(await page.getByRole('navigation',{name:'求职流程'}).innerText()).includes('核对岗位'));
  await page.getByRole('button',{name:'返回工作台',exact:true}).click();
  await page.screenshot({path:'.export-qa/workbench-v2-home.png'});
  await page.getByRole('button', { name: '卡片', exact: true }).click();
  assert.equal(await page.locator('.resume-thumbnail[aria-hidden="true"]').count(), 2);
  await page.getByRole('button', { name: '列表', exact: true }).click();
  await page.locator('ul.divide-y').waitFor();
  await page.screenshot({ path: '.export-qa/usability-home.png' });
  await page.getByRole('button', { name: '打开简历：回归示例公司 · AI 应用工程师', exact: true }).click();
  await page.getByRole('textbox', { name: '姓名', exact: true }).waitFor();
  for (const width of [1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 960 });
    await page.getByRole('button', { name: '建议', exact: true }).click();
    const panel = page.getByRole('complementary').filter({ has: page.getByRole('button', { name: '关闭 AI 与 JD 面板', exact: true }) });
    await panel.waitFor();
    const fieldBounds = await page.getByRole('textbox', { name: '目标职位', exact: true }).boundingBox();
    const panelBounds = await panel.boundingBox();
    assert(fieldBounds.x + fieldBounds.width <= panelBounds.x, width + ': panel covers form');
    await page.getByRole('textbox', { name: '目标职位', exact: true }).focus();
    assert(await page.getByRole('textbox', { name: '目标职位', exact: true }).evaluate(el => el === document.activeElement));
    if (width === 1440) await page.screenshot({ path: '.export-qa/usability-desktop.png' });
    await page.getByRole('button', { name: '关闭 AI 与 JD 面板', exact: true }).click();
  }
  await page.setViewportSize({ width: 1440, height: 960 });
  const afterPanels = await page.evaluate(async id => {
    const { useApp } = await import('/src/lib/store.ts'); return JSON.stringify(useApp.getState().resumes.find(r => r.id === id));
  }, fixture.id);
  assert.equal(afterPanels, fixture.before);

  assert.match(await page.getByRole('navigation', { name: '求职流程' }).innerText(), /完善内容/);
  await page.getByRole('button', { name: '导出', exact: true }).click();
  await page.getByRole('dialog', { name: '检查并导出', exact: true }).waitFor();
  await page.getByRole('dialog').getByText(/电话仍含占位内容，请填写实际联系方式/).waitFor();
  assert(!(await page.getByRole('button', { name: '下载单份 JSON', exact: true }).isVisible()));
  assert((await page.getByRole('textbox', { name: '导出文件名称', exact: true }).inputValue()).includes('回归示例公司'));
  await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('textbox', { name: '电话', exact: true }).fill('13800000000');
  await page.getByRole('textbox', { name: '邮箱', exact: true }).fill('qa@demo.invalid');
  const workflow = page.getByRole('navigation', { name: '求职流程' });
  assert.match(await workflow.innerText(), /核对岗位/);
  await page.getByRole('button', { name: '岗位要求', exact: true }).click();
  await page.getByRole('button', { name: '确认岗位内容已核对', exact: true }).click();
  assert.match(await workflow.locator('summary').innerText(), /预览与导出/);
  await page.getByRole('textbox', { name: '姓名', exact: true }).fill('回归虚构姓名');
  assert.match(await workflow.locator('summary').innerText(), /核对岗位/);

  await page.getByRole('button', { name: '岗位要求', exact: true }).click();
  await page.getByRole('button', { name: 'JD 匹配', exact: true }).click();
  await page.getByText('JD 原句与简历依据', { exact: true }).click();
  await page.getByText('发现相关工具证据，需确认实际使用范围：', { exact: true }).waitFor();
  await page.getByRole('button', { name: '分析与当前简历的匹配度', exact: true }).click();
  await page.getByText('相关工具证据待确认', { exact: true }).waitFor();
  assert.equal(await page.getByText('缺失技能', { exact: true }).count(), 0);
  await page.getByRole('button', { name: '关闭 AI 与 JD 面板', exact: true }).click();

  await page.getByRole('button', { name: '导出', exact: true }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '下载 DOCX', exact: true }).click()]);
  assert(download.suggestedFilename().includes('回归示例公司'));
  await page.getByRole('button', { name: '记录投递', exact: true }).click();
  await page.getByRole('dialog', { name: '新增投递记录', exact: true }).waitFor();
  await page.getByRole('combobox', { name: '状态', exact: true }).selectOption('applied');
  await page.getByRole('button', { name: '保存记录', exact: true }).click();
  const submissionSnapshot = await page.evaluate(async () => {
    const { useApp } = await import('/src/lib/store.ts'); return useApp.getState().applications[0].snapshot_id;
  });
  await page.getByRole('button', { name: '投递记录', exact: true }).click();
  await page.getByRole('button', { name: '更新进度', exact: true }).click();
  await page.getByRole('combobox', { name: '当前状态', exact: true }).selectOption('interview');
  await page.getByRole('textbox', { name: '追加反馈', exact: true }).fill('虚构反馈：准备技术面试');
  await page.getByRole('button', { name: '保存进度', exact: true }).click();
  await page.getByText('最近反馈：虚构反馈：准备技术面试', { exact: true }).waitFor();
  await page.getByText('累计已投递', { exact: true }).waitFor();
  await page.getByText('查看投递统计', { exact: true }).click();
  await page.getByText(/面试记录 1\/1/).waitFor();
  await page.getByText(/样本较少，暂不展示百分比/).waitFor();
  await page.getByRole('button', { name: '关闭提示', exact: true }).first().waitFor({ state: 'hidden', timeout: 10000 });
  await page.screenshot({ path: '.export-qa/usability-applications.png' });
  const saved = await page.evaluate(async () => {
    const { useApp } = await import('/src/lib/store.ts'); const a = useApp.getState().applications[0];
    return { snapshot: a.snapshot_id, events: a.events.map(e => e.status) };
  });
  assert.equal(saved.snapshot, submissionSnapshot); assert.deepEqual(saved.events, ['applied', 'interview']);
  await page.getByRole('button', { name: '只看待跟进', exact: true }).click();
  assert.equal(await page.getByRole('article').count(), 0);
  await page.getByRole('button', { name: '只看待跟进', exact: true }).click();
  await page.getByRole('button', { name: '更新进度', exact: true }).click();
  const today = await page.evaluate(async () => { const {fmtDate, nowISO}=await import('/src/lib/utils.ts'); return fmtDate(nowISO()); });
  await page.getByRole('textbox', { name: '下次跟进', exact: true }).fill(today);
  await page.getByRole('button', { name: '保存进度', exact: true }).click();
  await page.getByRole('button', { name: '只看待跟进', exact: true }).click();
  assert.equal(await page.getByRole('article').count(), 1);
  await page.setViewportSize({ width: 375, height: 812 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 375);

  await page.goto(origin + '#/editor/' + fixture.id);
  await page.getByRole('textbox', { name: '姓名', exact: true }).waitFor();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('combobox', { name: '编辑工具', exact: true }).waitFor();
  const section = await page.getByRole('heading', { name: '基本信息', exact: true }).boundingBox();
  assert(section.y < 260, 'mobile editor still has too many header rows: ' + section.y);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 375);
  await page.getByRole('button', { name: '关闭提示', exact: true }).first().waitFor({ state: 'hidden', timeout: 10000 });
  await page.screenshot({ path: '.export-qa/usability-mobile.png' });
  await page.getByRole('button', { name: '导出', exact: true }).click();
  const mobileExport = page.getByRole('dialog', { name: '检查并导出', exact: true });
  await mobileExport.waitFor();
  const exportBounds = await mobileExport.boundingBox();
  assert(exportBounds.y >= 0 && exportBounds.y + exportBounds.height <= 812, 'mobile export does not fit viewport');
  await mobileExport.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('combobox', { name: '编辑工具', exact: true }).selectOption('versions');
  await page.getByRole('dialog', { name: '版本快照与比较', exact: true }).waitFor();
  await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
  const layoutId = await page.evaluate(async () => {
    const { useApp } = await import('/src/lib/store.ts');
    const { buildSampleResume } = await import('/src/lib/samples.ts');
    const { createResumeMeasurer } = await import('/src/components/resume-measure.tsx');
    const id = useApp.getState().createResume(buildSampleResume('frontend', 'experienced'), '只调整排版的回归示例');
    const original = useApp.getState().resumes.find(r => r.id === id);
    const work = original.data.sections.find(s => s.type === 'work_experience');
    const m = createResumeMeasurer(new AbortController().signal);
    const measurements = [];
    let chosen;
    try {
      for (let count = 2; count <= 8; count++) {
        const candidate = structuredClone(original);
        candidate.data.sections = candidate.data.sections.filter(s => ['basic_info', 'work_experience'].includes(s.type));
        candidate.data.sections.find(s => s.type === 'work_experience').blocks = Array.from({length:count}, (_, i) => ({...structuredClone(work.blocks[0]), block_id:'fit-ui-'+i, order:i}));
        candidate.theme = {...candidate.theme, font_size:14, density:'loose'};
        const before = await m.measure(candidate);
        const compact = await m.measure({...candidate, theme:{...candidate.theme, density:'compact'}});
        measurements.push({count, before:before.pages.length, height:before.contentHeight, compact:compact.pages.length, compactHeight:compact.contentHeight, fits:compact.fits});
        if (before.pages.length > 1 && compact.fits) { chosen=candidate; break; }
      }
    } finally { m.dispose(); }
    if (!chosen) throw new Error('Could not construct a layout-only success fixture: '+JSON.stringify(measurements));
    useApp.setState(s => ({resumes:s.resumes.map(r=>r.id===id?chosen:r)}));
    return id;
  });
  await page.goto(origin + '#/editor/' + layoutId);
  await page.waitForFunction(() => document.querySelector('input[aria-label="简历标题"]')?.value === '只调整排版的回归示例');
  await page.getByRole('combobox', { name: '编辑工具', exact: true }).selectOption('layout');
  await page.getByRole('dialog', { name: '智能篇幅调整', exact: true }).waitFor();
  await page.getByRole('button', { name: '1 页', exact: true }).click();
  await page.getByText('正在测量实际版式…', { exact: true }).waitFor({ state: 'hidden', timeout: 60000 });
  await page.getByText('全部内容已保留，仅调整排版。', { exact: true }).waitFor();
  assert.equal(await page.getByRole('radio', { name: /精简部分内容/ }).count(), 0);
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await page.setViewportSize({width:1440,height:960});
  const classification = await page.evaluate(async id => {
    const {useApp}=await import('/src/lib/store.ts');
    const r=useApp.getState().resumes.find(r=>r.id===id);
    const skills=r.data.sections.find(s=>s.type==='skills');
    const block={...skills.blocks[0],type:'custom_text',title:'',skills:[],description:'掌握测试技术栈',bullets:['实际项目经验']};
    useApp.setState(s=>({resumes:s.resumes.map(r=>r.id===id?{...r,data:{...r.data,sections:r.data.sections.map(sec=>sec.section_id===skills.section_id?{...sec,title:'专业技能',type:'custom',blocks:[block]}:sec)}}:r)}));
    return {sectionId:skills.section_id,block:JSON.stringify(block)};
  },fixture.source);
  await page.goto(origin+'#/editor/'+fixture.source);
  await page.getByRole('tab',{name:'写内容',exact:true}).click();
  await page.getByRole('button',{name:'导出',exact:true}).click();
  await page.getByText('「专业技能」可在栏目设置中确认为技能类型',{exact:true}).waitFor();
  await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).click();
  const skillSection=page.locator('[data-section-id="'+classification.sectionId+'"]');
  await skillSection.getByText('栏目设置',{exact:true}).click();
  await skillSection.getByRole('combobox',{name:'栏目用途：专业技能',exact:true}).selectOption('skills');
  assert.equal(await page.evaluate(async ({id,sectionId})=>{
    const {useApp}=await import('/src/lib/store.ts');
    return JSON.stringify(useApp.getState().resumes.find(r=>r.id===id).data.sections.find(s=>s.section_id===sectionId).blocks[0]);
  },{id:fixture.source,sectionId:classification.sectionId}),classification.block);
  await skillSection.getByText('栏目设置',{exact:true}).click();
  await page.getByRole('button',{name:'导出',exact:true}).click();
  assert.equal(await page.getByText(/确认为技能类型/).count(),0);
  await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).click();
  await page.getByRole('button',{name:'添加栏目',exact:true}).click();
  await page.getByPlaceholder('如：开源贡献 / 发表作品 / 语言能力').fill('回归作品列表');
  await page.getByRole('combobox',{name:'自定义栏目内容结构',exact:true}).selectOption('custom_text');
  await page.getByRole('dialog').getByRole('button',{name:'添加',exact:true}).click();
  const custom=page.locator('[data-section-id]').filter({has:page.getByRole('heading',{name:/回归作品列表/})});
  await custom.getByText('内容要点',{exact:true}).waitFor();
  assert.equal(await custom.getByText('职位或角色',{exact:true}).count(),0);
  await page.setViewportSize({width:375,height:812});
  await custom.getByText('栏目设置',{exact:true}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),375);
  await custom.getByText('栏目设置',{exact:true}).click();
  await page.getByRole('button',{name:'返回工作台',exact:true}).click();
  await page.screenshot({path:'.export-qa/usability-home-mobile.png'});
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ desktopWidths: [1280, 1440, 1920], noPanelOverlap: true, noImplicitEdits: true, mobileSectionTop: section.y,
    contextualMobileTools: true, placeholderChecks: true, reviewInvalidatedOnEdit: true, relatedEvidence: true,
    exportFilename: true, exportToApplication: true, frozenSubmission: true, quickFeedback: true, statsDenominators: true,
    compactList: true, dialogNames: true, allContentRetained: true, followupFilter: true, errors }, null, 2));
} catch (error) {
  const page = browser.contexts()[0]?.pages()[0];
  if (page) {
    await page.screenshot({ path: '.export-qa/usability-failure.png' }).catch(() => {});
    await writeFile('.export-qa/usability-failure-dom.txt', await page.content()).catch(() => {});
  }
  throw error;
} finally { await browser.close(); await server.close(); }
