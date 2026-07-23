'use client';
/**
 * 管路系统可视化 — 四系统管路（暖水/冷媒/新风/给水）+ 液压计算
 * 按设备类型自动生成各系统管路，可逐系统开关显示
 */
import { useMemo, useState } from 'react';
import { solveNetwork } from '../lib/hydraulic';
import type { PipeNode, Pipe } from '../lib/hydraulic';

const GRID = 40;

type Room   = { id:string; label:string; x:number; y:number; w:number; h:number };
type Device = { id:string; type:string; x:number; y:number; w:number; h:number; [k:string]:any };
type PosNode = PipeNode & { x:number; y:number };

// ── 系统定义 ──────────────────────────────────────────────────────────────
const SYSTEMS = [
  { id:'heating',  label:'暖水管',  color:'#dc2626', dash:'',          desc:'地暖供回水环路',  deviceType:'heat_pump'  },
  { id:'refrigerant',label:'冷媒管',color:'#0891b2', dash:'6,3',       desc:'冷媒铜管至室内机',deviceType:'heat_pump'  },
  { id:'freshair', label:'新风管',  color:'#16a34a', dash:'4,4',       desc:'新风送风至各房间',deviceType:'fresh_air'  },
  { id:'hotwater', label:'给水管',  color:'#d97706', dash:'8,2,2,2',   desc:'热水给水至卫浴',  deviceType:'water_heater'},
] as const;

type SystemId = typeof SYSTEMS[number]['id'];

function velColor(v:number,vmax=1.2){const f=Math.max(0,Math.min(1,v/vmax));return `rgb(${Math.round(37+f*183)},${Math.round(99-f*61)},${Math.round(235-f*197)})`;}
function dnWidth(dn:string){return Math.max(2,Math.min(10,parseInt(dn.replace('DN',''),10)/8));}

// 从热泵/设备到各房间构建通用树形网络
function buildTree(rooms:Room[], srcX:number, srcY:number, heatIdx:number):{nodes:PosNode[];pipes:Pipe[]} {
  if(!rooms.length) return {nodes:[],pipes:[]};
  const cx = rooms.reduce((s,r)=>s+r.x+r.w/2,0)/rooms.length;
  const cy = rooms.reduce((s,r)=>s+r.y+r.h/2,0)/rooms.length;
  const nodes:PosNode[] = [{id:'src',type:'source',x:srcX,y:srcY},{id:'mfd',type:'manifold',x:cx,y:cy}];
  const pipes:Pipe[] = [{id:'main',from:'src',to:'mfd',length_m:Math.max(1,(Math.abs(srcX-cx)+Math.abs(srcY-cy))/GRID),fittings:{elbow90:2,valve:1}}];
  rooms.forEach((r,i)=>{
    const rx=r.x+r.w/2,ry=r.y+r.h/2;
    nodes.push({id:r.id,type:'terminal',power_W:Math.round((r.w/GRID)*(r.h/GRID)*heatIdx),x:rx,y:ry});
    pipes.push({id:`p${i}`,from:'mfd',to:r.id,length_m:Math.max(1,(Math.abs(rx-cx)+Math.abs(ry-cy))/GRID),fittings:{elbow90:3}});
  });
  return {nodes,pipes};
}

// 新风系统：单管从新风机到各房间，不经过分水器
function buildFreshAirTree(rooms:Room[], fa:Device):{nodes:PosNode[];pipes:Pipe[]} {
  const srcX=fa.x+(fa.w||1)*GRID/2, srcY=fa.y+(fa.h||1)*GRID/2;
  const nodes:PosNode[] = [{id:'fa_src',type:'source',x:srcX,y:srcY}];
  const pipes:Pipe[] = [];
  rooms.forEach((r,i)=>{
    const rx=r.x+r.w/2,ry=r.y+r.h/2;
    nodes.push({id:`fa_${r.id}`,type:'terminal',power_W:Math.round((r.w/GRID)*(r.h/GRID)*30),x:rx,y:ry});
    pipes.push({id:`fa_p${i}`,from:'fa_src',to:`fa_${r.id}`,length_m:Math.max(1,(Math.abs(srcX-rx)+Math.abs(srcY-ry))/GRID),fittings:{elbow90:2}});
  });
  return {nodes,pipes};
}

interface Props { rooms:Room[]; devices:Device[] }

export default function PipeNetworkViz({rooms,devices}:Props) {
  const [supplyT, setSupplyT] = useState(75);
  const [heatIdx, setHeatIdx] = useState(60);
  const [visible, setVisible] = useState<Record<SystemId,boolean>>({heating:true,refrigerant:true,freshair:true,hotwater:true});

  const toggle = (id:SystemId) => setVisible(v=>({...v,[id]:!v[id]}));

  const hp  = devices.find(d=>d.type==='heat_pump');
  const fa  = devices.find(d=>d.type==='fresh_air');
  const wh  = devices.find(d=>d.type==='water_heater');

  const heatingNet = useMemo(()=>{
    if(!rooms.length||!hp) return null;
    const net = buildTree(rooms,hp.x+hp.w*GRID/2,hp.y+hp.h*GRID/2,heatIdx);
    try{const r=solveNetwork({nodes:net.nodes,pipes:net.pipes},{systemType:'heating',supplyT,returnT:supplyT-20});return{net,result:r};}
    catch{return{net,result:null};}
  },[rooms,hp,supplyT,heatIdx]);

  const refrigerantNet = useMemo(()=>{
    if(!rooms.length||!hp) return null;
    return buildTree(rooms,hp.x+hp.w*GRID/2,hp.y+hp.h*GRID/2,0);
  },[rooms,hp]);

  const freshairNet = useMemo(()=>{
    if(!rooms.length||!fa) return null;
    return buildFreshAirTree(rooms,fa);
  },[rooms,fa]);

  const hotwaterNet = useMemo(()=>{
    if(!rooms.length||!wh) return null;
    return buildTree(rooms,wh.x+(wh.w||1)*GRID/2,wh.y+(wh.h||1)*GRID/2,0);
  },[rooms,wh]);

  if(!rooms.length) return <div style={{padding:24,color:'var(--t-tertiary)',textAlign:'center'}}>请先添加房间和设备</div>;

  const xs=rooms.flatMap(r=>[r.x,r.x+r.w]), ys=rooms.flatMap(r=>[r.y,r.y+r.h]);
  const vx=Math.min(...xs)-24, vy=Math.min(...ys)-24;
  const vw=Math.max(...xs)-vx+48, vh=Math.max(...ys)-vy+48;

  // 渲染单个系统管路
  function renderPipes(net:{nodes:PosNode[];pipes:Pipe[]}, color:string, dash:string, segMap?:Map<string,any>, worstSet?:Set<string>) {
    const nodeMap = new Map(net.nodes.map(n=>[n.id,n]));
    return net.pipes.map(p=>{
      const from=nodeMap.get(p.from), to=nodeMap.get(p.to);
      if(!from||!to) return null;
      const seg = segMap?.get(p.id);
      const isWorst = worstSet?.has(p.id);
      const c = isWorst ? 'var(--danger)' : (seg ? velColor(seg.velocity) : color);
      const w = seg ? dnWidth(seg.dn) : 3;
      const mx=to.x;
      return (
        <g key={p.id}>
          <polyline points={`${from.x},${from.y} ${mx},${from.y} ${mx},${to.y}`}
            fill="none" stroke={c} strokeWidth={w+2} strokeLinecap="round" opacity={0.2}
            strokeDasharray={dash}/>
          <polyline points={`${from.x},${from.y} ${mx},${from.y} ${mx},${to.y}`}
            fill="none" stroke={c} strokeWidth={w} strokeLinecap="round"
            strokeDasharray={dash}/>
          {seg&&<text x={(from.x+mx)/2} y={from.y-5} textAnchor="middle" fontSize={8} fill={c} fontWeight={600}>{seg.dn} {seg.velocity.toFixed(1)}m/s</text>}
        </g>
      );
    });
  }

  function renderNodes(nodes:PosNode[], color:string, prefix:string) {
    return nodes.map(n=>(
      <g key={n.id}>
        <circle cx={n.x} cy={n.y} r={n.type==='source'?9:n.type==='manifold'?7:5} fill={color} stroke="#fff" strokeWidth={1.5}/>
        <text x={n.x} y={n.y+16} textAnchor="middle" fontSize={8} fill={color} fontWeight={600}>
          {n.type==='source'?prefix+'源':n.type==='manifold'?'分配器':n.id.replace('fa_','').slice(0,3)}
        </text>
      </g>
    ));
  }

  const heatingSegMap = new Map((heatingNet?.result?.segments||[]).map((s:any)=>[s.pipeId,s]));
  const worstPipes    = new Set<string>(heatingNet?.result?.worstLoop.pipes||[]);

  return (
    <div style={{display:'flex',gap:16}}>
      <div style={{flex:1,minWidth:0}}>
        {/* 系统图例/开关 */}
        <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:10}}>
          {SYSTEMS.map(sys=>(
            <button key={sys.id} onClick={()=>toggle(sys.id as SystemId)} title={sys.desc} style={{
              display:'inline-flex',alignItems:'center',gap:5,padding:'3px 10px',borderRadius:9999,
              border:`1.5px solid ${sys.color}`,cursor:'pointer',fontSize:11,fontWeight:600,
              background:visible[sys.id as SystemId]?sys.color:'transparent',
              color:visible[sys.id as SystemId]?'#fff':sys.color,transition:'all 0.12s',
            }}>
              <svg width={16} height={4}><line x1={0} y1={2} x2={16} y2={2} stroke={visible[sys.id as SystemId]?'#fff':sys.color} strokeWidth={2} strokeDasharray={sys.dash}/></svg>
              {sys.label}
            </button>
          ))}
        </div>

        <svg viewBox={`${vx} ${vy} ${vw} ${vh}`} style={{width:'100%',background:'var(--surface-2)',borderRadius:'var(--r-sm)'}}>
          {/* 房间 */}
          {rooms.map(r=>(
            <g key={r.id}>
              <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="#eff6ff" stroke="#93c5fd" strokeWidth={1.5} rx={2}/>
              <text x={r.x+6} y={r.y+14} fontSize={10} fill="var(--t-primary)" fontWeight={600}>{r.label}</text>
            </g>
          ))}

          {/* 各系统管路 */}
          {visible.heating    && heatingNet     && renderPipes(heatingNet.net,      '#dc2626', '',       heatingSegMap, worstPipes)}
          {visible.refrigerant&& refrigerantNet && renderPipes(refrigerantNet,      '#0891b2', '6,3')}
          {visible.freshair   && freshairNet    && renderPipes(freshairNet,         '#16a34a', '4,4')}
          {visible.hotwater   && hotwaterNet    && renderPipes(hotwaterNet,         '#d97706', '8,2,2,2')}

          {/* 节点 */}
          {visible.heating    && heatingNet     && renderNodes(heatingNet.net.nodes,    '#dc2626','暖')}
          {visible.refrigerant&& refrigerantNet && renderNodes(refrigerantNet.nodes,    '#0891b2','冷')}
          {visible.freshair   && freshairNet    && renderNodes(freshairNet.nodes,       '#16a34a','风')}
          {visible.hotwater   && hotwaterNet    && renderNodes(hotwaterNet.nodes,       '#d97706','水')}
        </svg>

        {/* 图例说明 */}
        <div style={{display:'flex',gap:12,marginTop:8,flexWrap:'wrap'}}>
          {[['──','#dc2626','暖水供回'],['- - -','#0891b2','冷媒铜管'],['· · ·','#16a34a','新风管道'],['━ · ━','#d97706','给水管']].map(([d,c,l])=>(
            <span key={l} style={{fontSize:10,color:'var(--t-secondary)',display:'flex',alignItems:'center',gap:3}}>
              <span style={{color:c,fontFamily:'monospace'}}>{d}</span>{l}
            </span>
          ))}
        </div>
      </div>

      {/* 液压参数面板 */}
      <div style={{width:220,fontSize:13,flexShrink:0}}>
        <div style={{fontWeight:700,color:'var(--t-strong)',marginBottom:12}}>暖水系统液压</div>

        <label style={{fontSize:11,color:'var(--t-secondary)',display:'block',marginBottom:3}}>供水温度 <b style={{color:'var(--t-primary)'}}>{supplyT}°C</b></label>
        <input type="range" min={45} max={90} value={supplyT} onChange={e=>setSupplyT(+e.target.value)}
          style={{width:'100%',marginBottom:12,accentColor:'var(--brand)'}}/>

        <label style={{fontSize:11,color:'var(--t-secondary)',display:'block',marginBottom:3}}>热指标 <b style={{color:'var(--t-primary)'}}>{heatIdx} W/m²</b></label>
        <input type="range" min={30} max={120} step={5} value={heatIdx} onChange={e=>setHeatIdx(+e.target.value)}
          style={{width:'100%',marginBottom:14,accentColor:'var(--brand)'}}/>

        {heatingNet?.result ? (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
            {[['总流量',`${heatingNet.result.totalFlow_Lh}L/h`],['泵扬程',`${heatingNet.result.pump.head_m}m`],
              ['最大压降',`${heatingNet.result.worstLoop.dropOneWay_kPa}kPa`],['最不利路',heatingNet.result.worstLoop.terminal||'-']
            ].map(([l,v])=>(
              <div key={l} className="card-elevated" style={{padding:'7px 9px'}}>
                <div style={{fontSize:10,color:'var(--t-tertiary)'}}>{l}</div>
                <div style={{fontWeight:700,color:'var(--t-strong)',fontSize:12}}>{v}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{fontSize:12,color:'var(--t-tertiary)',padding:'8px 0'}}>
            {hp ? '计算中…' : '⚠️ 未放置热泵主机'}
          </div>
        )}

        {heatingNet?.result?.warnings.length ? (
          <div style={{marginTop:10,padding:8,borderRadius:'var(--r-sm)',background:'var(--danger-bg)',color:'var(--danger)',fontSize:11}}>
            {heatingNet.result.warnings.map((w:string,i:number)=><div key={i}>⚠ {w}</div>)}
          </div>
        ) : null}

        {/* 缺失设备提示 */}
        <div style={{marginTop:12,display:'flex',flexDirection:'column',gap:4}}>
          {!fa&&<div style={{fontSize:11,color:'var(--warning)',background:'var(--warning-bg)',borderRadius:4,padding:'3px 8px'}}>未放置新风机 — 新风管路无法生成</div>}
          {!wh&&<div style={{fontSize:11,color:'var(--warning)',background:'var(--warning-bg)',borderRadius:4,padding:'3px 8px'}}>未放置热水器 — 给水管路无法生成</div>}
        </div>
      </div>
    </div>
  );
}
