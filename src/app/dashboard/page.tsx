"use client";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const MIN = 75;
const ALL_DAYS = ["Day 1","Day 2","Day 3","Day 4","Day 5"];

function pctColor(p: number) { return p>=85?"#22c55e":p>=MIN?"#f59e0b":"#ef4444"; }
function skipCalc(a:number,t:number){ return Math.max(0,Math.floor((a-t*MIN/100)/(MIN/100))); }
function needCalc(a:number,t:number){ const mn=MIN/100; return Math.max(0,Math.ceil((t*mn-a)/(1-mn))); }
function parseTime(t:string) {
  const m = String(t||"").match(/(\d{1,2}):(\d{2})/);
  if (!m) return 0;
  let h = parseInt(m[1]);
  if (h < 8) h += 12;
  return h*60+parseInt(m[2]);
}

type Attendance = { courseCode:string; courseTitle:string; slot:string; attended:number; total:number; percentage:number; faculty?:string; room?:string; };
type TestScore = { testName:string; scored:number; maximum:number };
type Marks = { courseCode:string; courseTitle:string; testPerformance:TestScore[] };
type TimetableEntry = { courseCode:string; courseTitle:string; slot:string; faculty:string; room:string; type:string };
type SlotTiming = { start:string; end:string };
type SlotGrid = Record<string, Record<string, SlotTiming>>;
type SrmData = { attendance:Attendance[]; marks:Marks[]; timetable:TimetableEntry[]; slotGrid:SlotGrid; todayDayOrder:string; batchNumber?:number; info?:{scrapedAt:string} };

function buildSchedule(data: SrmData, dayOrder: string) {
  if (!dayOrder || !data.slotGrid[dayOrder]) return [];
  const daySlots = data.slotGrid[dayOrder];
  const seen = new Set<string>();
  const result: any[] = [];
  (data.timetable||[]).forEach(entry => {
    entry.slot.split(/[-,]/).map(s=>s.trim()).filter(Boolean).forEach(code => {
      if (!daySlots[code]) return;
      const key = entry.courseCode+"|"+code;
      if (seen.has(key)) return;
      seen.add(key);
      result.push({ ...entry, displaySlot:code, ...daySlots[code] });
    });
  });
  return result.sort((a,b)=>parseTime(a.start)-parseTime(b.start));
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [srmData, setSrmData] = useState<SrmData|null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"today"|"att"|"marks"|"sim">("today");
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [simState, setSimState] = useState<Record<string,{leaves:number;od:number}>>({});
  const [syncedAt, setSyncedAt] = useState<string|null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status]);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/sync")
        .then(r=>r.json())
        .then(res => {
          if (res.data) {
            setSrmData(res.data);
            setSelectedDay(res.data.todayDayOrder || "Day 1");
            setSyncedAt(res.syncedAt);
          }
          setLoading(false);
        })
        .catch(()=>setLoading(false));
    }
  }, [status]);

  if (status === "loading" || loading) return (
    <div style={s.center}><div style={s.spinner}></div></div>
  );

  if (!srmData) return (
    <div style={s.page}>
      <div style={{...s.card, textAlign:"center", padding:"3rem 2rem"}}>
        <div style={{fontSize:"3rem",marginBottom:"1rem",opacity:.4}}>🔌</div>
        <div style={s.heading}>No data yet</div>
        <p style={s.sub}>Open the SRM Desk Chrome extension on your laptop,<br/>sync your data, then click "↑ Upload to Cloud".</p>
        <button style={s.signOutBtn} onClick={()=>signOut()}>Sign out</button>
      </div>
    </div>
  );

  const att = srmData.attendance || [];
  const todayDay = srmData.todayDayOrder || "Day 1";
  const totalAtt = att.reduce((a,r)=>a+(r.attended||0),0);
  const totalCls = att.reduce((a,r)=>a+(r.total||0),0);
  const overallPct = totalCls ? Math.round(totalAtt/totalCls*100) : 0;
  const todaySlots = buildSchedule(srmData, selectedDay);
  const now = new Date().getHours()*60+new Date().getMinutes();
  const isActualToday = selectedDay === todayDay;

  function simChange(code: string, field: "leaves"|"od", delta: number) {
    setSimState(prev => {
      const cur = prev[code] || {leaves:0, od:0};
      return { ...prev, [code]: { ...cur, [field]: Math.max(0,(cur[field]||0)+delta) } };
    });
  }

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.hdr}>
        <div>
          <div style={s.brand}>SRM <span style={s.accentTxt}>DESK</span></div>
          <div style={s.metaTxt}>
            {session?.user?.email?.split("@")[0]} ·{" "}
            {syncedAt ? "synced "+new Date(syncedAt).toLocaleDateString("en-IN",{day:"numeric",month:"short"}) : "not synced"}
            {srmData.batchNumber ? " · Batch "+srmData.batchNumber : ""}
          </div>
        </div>
        <button style={s.signOutBtn} onClick={()=>signOut()}>sign out</button>
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        {(["today","att","marks","sim"] as const).map(t => (
          <button key={t} style={{...s.tabBtn, ...(tab===t?(t==="sim"?s.tabActiveSim:s.tabActive):{})}} onClick={()=>setTab(t)}>
            {t === "today" ? "Today" : t === "att" ? "Attendance" : t === "marks" ? "Marks" : "Simulator"}
          </button>
        ))}
      </div>

      {/* TODAY */}
      {tab === "today" && (
        <div>
          {/* Summary chips */}
          <div style={s.chips}>
            <div style={s.chip}><span style={{color:pctColor(overallPct),fontWeight:700}}>{overallPct}%</span><span style={s.chipLbl}>overall</span></div>
            <div style={s.chip}><span style={{color:"#22c55e",fontWeight:700}}>{att.reduce((a,r)=>a+skipCalc(r.attended||0,r.total||0),0)}</span><span style={s.chipLbl}>can skip</span></div>
            <div style={s.chip}><span style={{fontWeight:700}}>{todaySlots.length}</span><span style={s.chipLbl}>{selectedDay}</span></div>
          </div>

          {/* Day selector */}
          <div style={s.dayRow}>
            {ALL_DAYS.map(day => (
              <button key={day} style={{...s.dayBtn, ...(selectedDay===day?s.dayBtnActive:{})}} onClick={()=>setSelectedDay(day)}>
                {day.replace("Day ","")}
                {day===todayDay && <span style={{color:"#22c55e",fontSize:".45rem",marginLeft:3,verticalAlign:"super"}}>●</span>}
              </button>
            ))}
          </div>

          {/* Schedule */}
          <div style={{display:"flex",flexDirection:"column",gap:".5rem"}}>
            {todaySlots.length === 0
              ? <div style={s.empty}>No classes for {selectedDay}!</div>
              : todaySlots.map((slot, i) => {
                  const start=parseTime(slot.start), end=parseTime(slot.end);
                  const isNow=isActualToday&&start<=now&&now<end;
                  const isPast=isActualToday&&end>0&&end<=now;
                  const isLab=slot.type?.toLowerCase().includes("lab")||slot.slot?.startsWith("P")||slot.slot?.startsWith("L");
                  return (
                    <div key={i} style={{...s.clsCard, ...(isNow?s.clsNow:{}), opacity:isPast?.5:1}}>
                      {isNow && <div style={s.nowBar}></div>}
                      <div style={s.clsTime}>
                        <div style={{fontFamily:"monospace",fontSize:".9rem",fontWeight:700,color:"#7c3aed"}}>{slot.start}</div>
                        <div style={{fontFamily:"monospace",fontSize:".55rem",color:"#64748b"}}>{slot.end}</div>
                        <div style={{fontFamily:"monospace",fontSize:".55rem",color:"#7c3aed",marginTop:2}}>{slot.displaySlot}</div>
                      </div>
                      <div style={s.clsBody}>
                        <div style={{fontSize:".85rem",fontWeight:600,marginBottom:2}}>{slot.courseTitle}</div>
                        <div style={{fontFamily:"monospace",fontSize:".6rem",color:"#64748b"}}>{slot.faculty} {slot.room?"📍"+slot.room:""}</div>
                      </div>
                      <span style={{...s.badge, ...(isLab?s.badgeLab:s.badgeTheory)}}>{isLab?"LAB":"THEORY"}</span>
                    </div>
                  );
                })
            }
          </div>
        </div>
      )}

      {/* ATTENDANCE */}
      {tab === "att" && (
        <div style={{display:"flex",flexDirection:"column",gap:".7rem"}}>
          {att.map((r,i) => {
            const p=r.total?Math.round((r.attended||0)/r.total*100):(r.percentage||0);
            const c=pctColor(p), skip=skipCalc(r.attended||0,r.total||0), need=needCalc(r.attended||0,r.total||0);
            return (
              <div key={i} style={{...s.attCard, borderTop:`3px solid ${c}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:".85rem",fontWeight:700}}>{r.courseTitle}</div>
                    <div style={{fontFamily:"monospace",fontSize:".6rem",color:"#64748b"}}>{r.courseCode} {r.slot?"· slot "+r.slot:""}</div>
                  </div>
                  <div style={{fontFamily:"monospace",fontSize:"1.5rem",fontWeight:700,color:c,lineHeight:1}}>{p}%</div>
                </div>
                <div style={{height:4,background:"#1a1a2e",borderRadius:100,overflow:"hidden",marginBottom:8,position:"relative"}}>
                  <div style={{height:"100%",width:Math.min(p,100)+"%",background:c,borderRadius:100}}></div>
                  <div style={{position:"absolute",top:0,bottom:0,left:"75%",width:2,background:"rgba(245,158,11,.6)"}}></div>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontFamily:"monospace",fontSize:".65rem",color:"#64748b"}}>{r.attended}/{r.total} classes</span>
                  {p>=MIN
                    ? <span style={{...s.badge, background:"rgba(34,197,94,.12)",color:"#22c55e",border:"1px solid rgba(34,197,94,.25)"}}>✓ skip {skip}</span>
                    : <span style={{...s.badge, background:"rgba(239,68,68,.12)",color:"#ef4444",border:"1px solid rgba(239,68,68,.25)"}}>⚠ need {need}</span>
                  }
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MARKS */}
      {tab === "marks" && (
        <div style={{display:"flex",flexDirection:"column",gap:".7rem"}}>
          {(srmData.marks||[]).map((s2,i) => {
            const done=(s2.testPerformance||[]).filter(t=>t.scored>=0);
            const ts=done.reduce((a,t)=>a+t.scored,0), tm=done.reduce((a,t)=>a+t.maximum,0);
            const tp=tm?Math.round(ts/tm*100):0;
            return (
              <div key={i} style={s.markCard}>
                <div style={{fontSize:".85rem",fontWeight:700,marginBottom:2}}>{s2.courseTitle}</div>
                <div style={{fontFamily:"monospace",fontSize:".6rem",color:"#64748b",marginBottom:8}}>{s2.courseCode}</div>
                {(s2.testPerformance||[]).map((t,j) => (
                  <div key={j} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 8px",background:"rgba(255,255,255,.02)",border:"1px solid #1a1a2e",borderRadius:6,marginBottom:4}}>
                    <span style={{fontSize:".75rem",color:"#64748b"}}>{t.testName} <span style={{fontSize:".6rem"}}>/{t.maximum}</span></span>
                    <span style={{fontFamily:"monospace",fontWeight:700,fontSize:".9rem",color:t.scored<0?"#64748b":pctColor(t.maximum?Math.round(t.scored/t.maximum*100):0)}}>{t.scored<0?"—":t.scored}</span>
                  </div>
                ))}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 8px",background:"rgba(6,182,212,.06)",border:"1px solid rgba(6,182,212,.2)",borderRadius:6,marginTop:4}}>
                  <span style={{fontSize:".8rem",fontWeight:600}}>Total so far</span>
                  <span style={{fontFamily:"monospace",fontWeight:700,color:pctColor(tp)}}>{ts}/{tm} ({tp}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SIMULATOR */}
      {tab === "sim" && (
        <div>
          <div style={s.simIntro}>
            <b style={{color:"#06b6d4"}}>Simulator</b> — add planned leaves or ODs to see your projected attendance.
          </div>
          {/* summary */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:"1.2rem"}}>
            {[
              ["AVG PROJ", att.length ? Math.round(att.reduce((sum,r)=>{
                const ss=simState[r.courseCode]||{leaves:0,od:0};
                const pa=Math.max(0,(r.attended||0)+ss.od-ss.leaves);
                const pt=(r.total||0)+ss.od+ss.leaves;
                return sum+(pt>0?pa/pt*100:(r.percentage||0));
              },0)/att.length)+"%":"—", pctColor(att.length?Math.round(att.reduce((sum,r)=>{
                const ss=simState[r.courseCode]||{leaves:0,od:0};
                const pa=Math.max(0,(r.attended||0)+ss.od-ss.leaves);
                const pt=(r.total||0)+ss.od+ss.leaves;
                return sum+(pt>0?pa/pt*100:(r.percentage||0));
              },0)/att.length):0)],
              ["LEAVES", att.reduce((a,r)=>a+(simState[r.courseCode]?.leaves||0),0), "#ef4444"],
              ["OD", att.reduce((a,r)=>a+(simState[r.courseCode]?.od||0),0), "#22c55e"],
            ].map(([lbl,val,col],i) => (
              <div key={i} style={s.simChip}>
                <div style={{fontFamily:"monospace",fontSize:".55rem",color:"#64748b",marginBottom:3}}>{lbl}</div>
                <div style={{fontFamily:"monospace",fontSize:"1.2rem",fontWeight:700,color:col as string}}>{val}</div>
              </div>
            ))}
          </div>
          {/* per subject */}
          <div style={{display:"flex",flexDirection:"column",gap:".7rem"}}>
            {att.map((r,i) => {
              const code = r.courseCode;
              const ss = simState[code] || {leaves:0, od:0};
              const proj_a = Math.max(0,(r.attended||0)+ss.od-ss.leaves);
              const proj_t = (r.total||0)+ss.od+ss.leaves;
              const proj_pct = proj_t>0 ? Math.round(proj_a/proj_t*10000)/100 : (r.percentage||0);
              const curr_pct = r.percentage || (r.total?Math.round((r.attended||0)/r.total*100):0);
              const delta = proj_pct - curr_pct;
              const skip = skipCalc(proj_a, proj_t);
              const need = needCalc(proj_a, proj_t);
              return (
                <div key={i} style={s.simCard}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:".82rem",fontWeight:700}}>{r.courseTitle}</div>
                      <div style={{fontFamily:"monospace",fontSize:".58rem",color:"#64748b"}}>{code} · slot {r.slot||"?"}</div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div style={{fontFamily:"monospace",fontSize:"1.4rem",fontWeight:700,color:pctColor(curr_pct),lineHeight:1}}>{curr_pct}%</div>
                      <div style={{fontFamily:"monospace",fontSize:".58rem",color:"#64748b"}}>{r.attended}/{r.total} now</div>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                    {[["LEAVES","leaves","#ef4444"] as const, ["OD","od","#22c55e"] as const].map(([lbl,field,col]) => (
                      <div key={field}>
                        <div style={{fontFamily:"monospace",fontSize:".55rem",color:"#64748b",marginBottom:4}}>{lbl}</div>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <button style={s.simBtn} onClick={()=>simChange(code,field,-1)}>−</button>
                          <span style={{fontFamily:"monospace",fontSize:".85rem",fontWeight:700,color:col,minWidth:24,textAlign:"center"}}>{ss[field]}</span>
                          <button style={s.simBtn} onClick={()=>simChange(code,field,+1)}>+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 10px",background:"rgba(255,255,255,.02)",border:"1px solid #1a1a2e",borderRadius:8}}>
                    <div>
                      <div style={{fontFamily:"monospace",fontSize:".55rem",color:"#64748b"}}>PROJECTED</div>
                      <div style={{fontFamily:"monospace",fontWeight:700,color:pctColor(proj_pct)}}>{proj_pct.toFixed(1)}% <span style={{fontFamily:"monospace",fontSize:".6rem",color:"#64748b"}}>{proj_a}/{proj_t}</span></div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3}}>
                      <span style={{fontFamily:"monospace",fontSize:".6rem",padding:"2px 7px",borderRadius:100,
                        background:delta===0?"rgba(100,116,139,.1)":delta>0?"rgba(34,197,94,.1)":"rgba(239,68,68,.1)",
                        color:delta===0?"#64748b":delta>0?"#22c55e":"#ef4444",
                        border:`1px solid ${delta===0?"rgba(100,116,139,.2)":delta>0?"rgba(34,197,94,.2)":"rgba(239,68,68,.2)"}`}}>
                        {delta===0?"no change":delta>0?"+"+Math.abs(delta).toFixed(1)+"%":"-"+Math.abs(delta).toFixed(1)+"%"}
                      </span>
                      <span style={{fontFamily:"monospace",fontSize:".6rem",padding:"2px 7px",borderRadius:100,
                        background:proj_pct>=MIN?"rgba(34,197,94,.1)":"rgba(239,68,68,.1)",
                        color:proj_pct>=MIN?"#22c55e":"#ef4444",
                        border:`1px solid ${proj_pct>=MIN?"rgba(34,197,94,.2)":"rgba(239,68,68,.2)"}`}}>
                        {proj_pct>=MIN?"skip "+skip+" more":"need "+need+" more"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <button style={{...s.signOutBtn,marginTop:"1.2rem",width:"100%"}} onClick={()=>{setSimState({});}}>Reset All</button>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight:"100vh", background:"#07070f", color:"#e2e8f0",
    backgroundImage:"linear-gradient(rgba(124,58,237,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(124,58,237,.03) 1px,transparent 1px)",
    backgroundSize:"44px 44px", padding:"1rem", fontFamily:"'Syne',sans-serif" },
  center: { minHeight:"100vh", background:"#07070f", display:"flex", alignItems:"center", justifyContent:"center" },
  spinner: { width:32, height:32, border:"3px solid #1a1a2e", borderTop:"3px solid #7c3aed", borderRadius:"50%" },
  card: { background:"#0f0f1a", border:"1px solid #1a1a2e", borderRadius:20, padding:"2rem", maxWidth:400, width:"100%" },
  hdr: { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"1.2rem", paddingBottom:"1rem", borderBottom:"1px solid #1a1a2e" },
  brand: { fontFamily:"'Syne',sans-serif", fontSize:"1.5rem", fontWeight:800, color:"#e2e8f0" },
  accentTxt: { color:"#7c3aed" },
  metaTxt: { fontFamily:"monospace", fontSize:".58rem", color:"#64748b", marginTop:2 },
  heading: { fontFamily:"'Syne',sans-serif", fontSize:"1.3rem", fontWeight:700, color:"#e2e8f0", marginBottom:".5rem" },
  sub: { fontFamily:"monospace", fontSize:".7rem", color:"#64748b", lineHeight:1.7, marginBottom:"1.2rem" },
  signOutBtn: { background:"transparent", border:"1px solid #1a1a2e", color:"#64748b", padding:"5px 12px", borderRadius:7, fontFamily:"monospace", fontSize:".6rem", cursor:"pointer" },
  tabs: { display:"flex", gap:4, marginBottom:"1.2rem", background:"#0f0f1a", padding:4, borderRadius:10, border:"1px solid #1a1a2e", overflowX:"auto" },
  tabBtn: { padding:"7px 12px", borderRadius:7, border:"none", background:"transparent", color:"#64748b", fontFamily:"monospace", fontSize:".65rem", cursor:"pointer", whiteSpace:"nowrap" },
  tabActive: { background:"#7c3aed", color:"#fff" },
  tabActiveSim: { background:"#06b6d4", color:"#000" },
  chips: { display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:"1rem" },
  chip: { background:"#0f0f1a", border:"1px solid #1a1a2e", borderRadius:10, padding:"8px 10px", display:"flex", flexDirection:"column", alignItems:"center", gap:3 },
  chipLbl: { fontFamily:"monospace", fontSize:".55rem", color:"#64748b" },
  dayRow: { display:"flex", gap:6, marginBottom:"1rem", flexWrap:"wrap" },
  dayBtn: { padding:"5px 10px", borderRadius:7, border:"1px solid #1a1a2e", background:"#0f0f1a", color:"#64748b", fontFamily:"monospace", fontSize:".62rem", cursor:"pointer" },
  dayBtnActive: { background:"#7c3aed", color:"#fff", borderColor:"#7c3aed" },
  empty: { textAlign:"center" as const, padding:"3rem", color:"#64748b", fontFamily:"monospace", fontSize:".7rem" },
  clsCard: { display:"flex", alignItems:"stretch", borderRadius:12, overflow:"hidden", border:"1px solid #1a1a2e", background:"#0f0f1a", position:"relative" },
  clsNow: { borderColor:"rgba(34,197,94,.4)", background:"rgba(34,197,94,.03)" },
  nowBar: { position:"absolute", left:0, top:0, bottom:0, width:3, background:"#22c55e", boxShadow:"0 0 8px #22c55e" },
  clsTime: { minWidth:75, background:"rgba(124,58,237,.08)", borderRight:"1px solid rgba(124,58,237,.15)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"10px 5px", gap:2 },
  clsBody: { flex:1, padding:"10px 12px", display:"flex", flexDirection:"column", justifyContent:"center" },
  badge: { fontFamily:"monospace", fontSize:".55rem", padding:"3px 8px", borderRadius:5, margin:"auto 8px", flexShrink:0, whiteSpace:"nowrap" as const },
  badgeTheory: { background:"rgba(124,58,237,.12)", color:"#7c3aed", border:"1px solid rgba(124,58,237,.25)" },
  badgeLab: { background:"rgba(6,182,212,.12)", color:"#06b6d4", border:"1px solid rgba(6,182,212,.25)" },
  attCard: { background:"#0f0f1a", border:"1px solid #1a1a2e", borderRadius:14, padding:"12px 14px" },
  markCard: { background:"#0f0f1a", border:"1px solid #1a1a2e", borderRadius:14, padding:"12px 14px" },
  simIntro: { background:"rgba(6,182,212,.05)", border:"1px solid rgba(6,182,212,.15)", borderRadius:10, padding:"10px 14px", fontFamily:"monospace", fontSize:".65rem", color:"#64748b", lineHeight:1.8, marginBottom:"1rem" },
  simChip: { background:"#0f0f1a", border:"1px solid #1a1a2e", borderRadius:10, padding:"8px 10px", textAlign:"center" as const },
  simCard: { background:"#0f0f1a", border:"1px solid #1a1a2e", borderRadius:14, padding:"12px 14px" },
  simBtn: { width:26, height:26, borderRadius:6, border:"1px solid #1a1a2e", background:"rgba(255,255,255,.04)", color:"#e2e8f0", fontSize:".9rem", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
};
