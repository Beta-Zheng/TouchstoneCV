import { describe, expect, it } from 'vitest';
import { defaultFitLocks, fitLayoutCost, onePageLayouts, removableFitEntries, visibleFitEntries, withHiddenEntries } from '../one-page';
import { testResume, testBlock } from './fixtures';

describe('篇幅调整的内容与排版边界',()=>{
  it('优先原版，先间距再缩字，不低于14px，并覆盖小数字号下限',()=>{
    const r=testResume();r.theme.font_size=16.2;r.theme.header_layout='stack';
    const plans=onePageLayouts(r);
    expect(plans[0]).toEqual(r);expect(plans[1].theme.font_size).toBe(16.2);
    expect(plans.some(p=>p.theme.font_size===14)).toBe(true);
    expect(plans.every(p=>p.theme.font_size>=14)).toBe(true);
    expect(r.theme.density).toBeUndefined();
  });
  it('不放大用户已选的小字号，不改写任何正文',()=>{
    const r=testResume();r.theme.font_size=12;
    expect(onePageLayouts(r).every(p=>p.theme.font_size===12&&p.data===r.data)).toBe(true);
  });
  it('隐藏条目保留全部事实、顺序和源数据，也不恢复原本隐藏的内容',()=>{
    const r=testResume();r.data.sections[0].blocks.push({...testBlock(),block_id:'hidden',visible:false});
    const before=structuredClone(r);const next=withHiddenEntries(r,new Set(['block_test']));
    expect(r).toEqual(before);expect(next.data.sections[0].blocks[0]).toEqual({...before.data.sections[0].blocks[0],visible:false});
    expect(next.data.sections[0].blocks[1].visible).toBe(false);
    expect(visibleFitEntries(next)).toHaveLength(0);
  });
  it('自动取舍保留最近工作和教育，并优先推荐移除不匹配JD的旧条目',()=>{
    const r=testResume();r.data.sections[0].blocks=[
      {...testBlock(),block_id:'recent',start_date:'2025-01',order:0},
      {...testBlock(),block_id:'matched',start_date:'2023-01',title:'React',order:1},
      {...testBlock(),block_id:'old',start_date:'2020-01',title:'其他经历',skills:[],description:'行政协作',bullets:[],order:2},
    ];
    r.data.sections.push({section_id:'edu',type:'education',title:'教育',visible:true,order:1,blocks:[{...testBlock(),block_id:'education'}]});
    const entries=removableFitEntries(r,['React','react']);
    expect(entries.map(e=>e.block.block_id)).toEqual(['old','matched']);
  });
  it('校招无工作经历时保留相关项目；已隐藏或空内容不参与建议',()=>{
    const r=testResume();r.audience='student';r.data.sections[0].type='project_experience';
    r.data.sections[0].blocks=[{...testBlock(),block_id:'project',title:'React'}, {...testBlock(),block_id:'old',title:'其他',skills:[],description:'课程',bullets:[]},{...testBlock(),block_id:'hidden',visible:false}];
    expect(removableFitEntries(r,['React']).map(e=>e.block.block_id)).toEqual(['old']);
  });
  it('在职和结束时间参与关键经历保护，不只比较开始时间',()=>{
    const r=testResume();r.data.sections[0].blocks=[
      {...testBlock(),block_id:'past',start_date:'2024-01',end_date:'2024-12'},
      {...testBlock(),block_id:'ongoing',start_date:'2020-01',end_date:'Present'},
    ];
    expect([...defaultFitLocks(r)]).toEqual(['ongoing']);
    r.data.sections[0].blocks[1].end_date='2025-1';
    expect([...defaultFitLocks(r)]).toEqual(['ongoing']);
  });
  it('用户锁定覆盖自动策略，也可主动解除默认保护',()=>{
    const r=testResume();
    expect(removableFitEntries(r,[],new Set())).toHaveLength(1);
    expect(removableFitEntries(r,[],new Set(['block_test']))).toHaveLength(0);
  });
  it('考虑节省空间，避免先牺牲多条同等相关的短经历',()=>{
    const r=testResume();r.data.sections[0].blocks=[{...testBlock(),block_id:'short'},{...testBlock(),block_id:'long'}];
    expect(removableFitEntries(r,[],new Set(),{short:60,long:300})[0].block.block_id).toBe('long');
    expect(removableFitEntries(r,['React'],new Set())[0].reason).toContain('命中 1 个岗位词项');
  });
  it('候选优先保留字号和适中间距，紧凑原稿不被放宽',()=>{
    const r=testResume();r.theme.font_size=16;
    const compact={...r,theme:{...r.theme,density:'compact' as const}};
    const small={...r,theme:{...r.theme,font_size:15.5}};
    expect(fitLayoutCost(r,compact)).toBeLessThan(fitLayoutCost(r,small));
    expect(fitLayoutCost(r,compact,.1)).toBeGreaterThan(fitLayoutCost(r,compact,.8));
    expect(onePageLayouts(compact).every(c=>c.theme.density==='compact')).toBe(true);
  });
});
