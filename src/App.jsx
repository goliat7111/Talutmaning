import React, { useEffect, useMemo, useRef, useState } from "react";
import { Calculator, ChevronLeft, ChevronRight, Dices, Eye, Lightbulb, List, Maximize, Minimize, RefreshCcw, Search, ShieldCheck } from "lucide-react";

const OPS = ["+", "−", "×", "÷"];
const gcd = (a,b) => { a=Math.abs(a); b=Math.abs(b); while(b) [a,b]=[b,a%b]; return a||1; };
const frac = (n,d=1) => { if(d===0)return null; if(d<0){n=-n;d=-d} const g=gcd(n,d); return {n:n/g,d:d/g}; };
const add=(a,b)=>frac(a.n*b.d+b.n*a.d,a.d*b.d), sub=(a,b)=>frac(a.n*b.d-b.n*a.d,a.d*b.d);
const mul=(a,b)=>frac(a.n*b.n,a.d*b.d), div=(a,b)=>b.n===0?null:frac(a.n*b.d,a.d*b.n);
const eq=(a,b)=>a&&b&&a.n===b.n&&a.d===b.d, fkey=a=>`${a.n}/${a.d}`, show=a=>a.d===1?`${a.n}`:`${a.n}/${a.d}`, wrap=s=>`(${s})`;

function permutations(values){ const out=[]; const go=(rest,built)=>{ if(!rest.length){out.push(built);return;} rest.forEach((v,i)=>go([...rest.slice(0,i),...rest.slice(i+1)],[...built,v]));}; go(values,[]); return out; }
function evaluateLevel1(numbers,operators,allowNegative){
  const values=numbers.map(n=>frac(n)), lows=[values[0]], lowOps=[];
  for(let i=0;i<operators.length;i++){
    const op=operators[i], next=values[i+1];
    if(op==="×"||op==="÷"){
      const left=lows.pop(), value=op==="×"?mul(left,next):div(left,next);
      if(!value||value.d!==1||(!allowNegative&&value.n<0)) return null; lows.push(value);
    } else { lowOps.push(op); lows.push(next); }
  }
  let result=lows[0];
  for(let i=0;i<lowOps.length;i++){ result=lowOps[i]==="+"?add(result,lows[i+1]):sub(result,lows[i+1]); if(!result||result.d!==1||(!allowNegative&&result.n<0))return null; }
  return result;
}
function solveLevel1(numbers,target,allowNegative,limit=50){
  const solutions=[],seen=new Set();
  for(const ordered of permutations(numbers)) for(let code=0;code<256;code++){
    let x=code; const operators=[]; for(let i=0;i<4;i++){operators.push(OPS[x%4]);x=Math.floor(x/4)}
    const value=evaluateLevel1(ordered,operators,allowNegative);
    if(value?.d===1&&value.n===target){ const expression=ordered.map((n,i)=>i?`${operators[i-1]} ${n}`:`${n}`).join(" "); if(!seen.has(expression)){seen.add(expression);solutions.push({expression,value});if(solutions.length>=limit)return solutions;} }
  }
  return solutions;
}
function solveTree(numbers,target,level,allowNegative,limit=50){
  const targetValue=frac(target), initial=numbers.map((n,i)=>({value:frac(n),expression:`${n}`,used:1<<i,prec:3,nest:0}));
  const solutions=[],seen=new Set(),visits=new Map();
  const PREC={"+":1,"−":1,"×":2,"÷":2};
  // Parenteser sätts bara där de behövs och får aldrig ligga inuti andra parenteser.
  const operand=(item,op,isRight)=>{
    const needsParens=item.prec<PREC[op]||(isRight&&item.prec===PREC[op]&&(op==="−"||op==="÷"));
    if(!needsParens)return {text:item.expression,nest:item.nest};
    if(item.nest>=1)return null;
    return {text:`(${item.expression})`,nest:item.nest+1};
  };
  const combine=(x,y,op,value)=>{
    const left=operand(x,op,false), right=operand(y,op,true);
    if(!left||!right)return null;
    return {value,expression:`${left.text} ${op} ${right.text}`,used:x.used|y.used,prec:PREC[op],nest:Math.max(left.nest,right.nest)};
  };
  const search=items=>{
    if(solutions.length>=limit)return;
    if(items.length===1){const item=items[0];if(eq(item.value,targetValue)&&!seen.has(item.expression)){seen.add(item.expression);solutions.push(item)}return;}
    const signature=items.map(x=>`${x.used}:${fkey(x.value)}:${x.prec}:${x.nest}`).sort().join("|"); const count=visits.get(signature)||0; if(count>=3)return; visits.set(signature,count+1);
    for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
      const a=items[i],b=items[j]; const candidates=[
        [a,b,"+",add(a.value,b.value)],
        [a,b,"×",mul(a.value,b.value)],
        [a,b,"−",sub(a.value,b.value)],
        [b,a,"−",sub(b.value,a.value)],
        [a,b,"÷",div(a.value,b.value)],
        [b,a,"÷",div(b.value,a.value)]
      ];
      for(const [x,y,op,value] of candidates){ if(!value||(level===2&&value.d!==1)||(!allowNegative&&value.n<0))continue; const merged=combine(x,y,op,value); if(!merged)continue; const next=items.filter((_,k)=>k!==i&&k!==j); next.push(merged); search(next); if(solutions.length>=limit)return; }
    }
  };
  search(initial); return solutions;
}
const solve=(numbers,target,level,allowNegative)=>level===1?solveLevel1(numbers,target,allowNegative):solveTree(numbers,target,level,allowNegative);

export default function App(){
  const [numbers,setNumbers]=useState(["","","","",""]), [target,setTarget]=useState("");
  const [level,setLevel]=useState(1), [allowNegative,setAllowNegative]=useState(false);
  const [status,setStatus]=useState("idle"), [solutions,setSolutions]=useState([]), [showSolutions,setShowSolutions]=useState(false);
  const [viewMode,setViewMode]=useState("one"), [solutionIndex,setSolutionIndex]=useState(0), [displayMode,setDisplayMode]=useState("start");
  const [isFullscreen,setIsFullscreen]=useState(false), [fullscreenError,setFullscreenError]=useState("");
  const screenRef=useRef(null);
  useEffect(()=>{
    const syncFullscreen=()=>setIsFullscreen(document.fullscreenElement===screenRef.current);
    document.addEventListener("fullscreenchange",syncFullscreen);
    return ()=>document.removeEventListener("fullscreenchange",syncFullscreen);
  },[]);
  const parsed=useMemo(()=>numbers.map(Number),[numbers]);
  const allNumbersValid=numbers.every((v,i)=>v!==""&&Number.isInteger(parsed[i])&&parsed[i]>=1&&parsed[i]<=9), numbersAreUnique=new Set(parsed).size===5;
  const validTarget=target!==""&&Number.isInteger(Number(target))&&Number(target)>=0, valid=allNumbersValid&&numbersAreUnique&&validTarget;
  const clear=()=>{setStatus("idle");setSolutions([]);setShowSolutions(false);setViewMode("one");setSolutionIndex(0)};
  const randomize=()=>{const unique=new Set();while(unique.size<5)unique.add(Math.floor(Math.random()*9)+1);setNumbers([...unique].map(String));clear()};
  const check=()=>{if(!valid)return;setStatus("searching");setShowSolutions(false);setTimeout(()=>{const found=solve(parsed,Number(target),level,allowNegative);setSolutions(found);setStatus(found.length?"found":"none")},50)};
  const reset=()=>{setNumbers(["","","","",""]);setTarget("");setLevel(1);setAllowNegative(false);setDisplayMode("start");clear()};
  const levelText={1:"Heltal, inga parenteser",2:"Heltal, parenteser tillåtna (inte inuti varandra)",3:"Bråktal och parenteser tillåtna (inte inuti varandra)"};
  const visible=viewMode==="five"?solutions.slice(0,5):solutions.length?[solutions[solutionIndex]]:[];
  const validation=!allNumbersValid?"Fyll i fem heltal från 1 till 9.":!numbersAreUnique?"De fem talen måste vara olika.":!validTarget?"Ange ett icke-negativt heltal som måltal.":"";
  const toggleFullscreen=async()=>{
    setFullscreenError("");
    try{
      if(document.fullscreenElement) await document.exitFullscreen();
      else if(screenRef.current?.requestFullscreen) await screenRef.current.requestFullscreen();
      else setFullscreenError("Helskärmsläge stöds inte i den här webbläsaren.");
    }catch{
      setFullscreenError("Det gick inte att ändra helskärmsläge.");
    }
  };

  if(displayMode==="game") return <main ref={screenRef} className="game-screen">
    <div className="game-actions">
      <button className="mode-button" onClick={()=>setDisplayMode("start")}><Eye/>Startvisning</button>
      <button className="mode-button fullscreen-button" onClick={toggleFullscreen}>{isFullscreen?<Minimize/>:<Maximize/>}{isFullscreen?"Avsluta helskärm":"Helskärm"}</button>
    </div>
    {fullscreenError&&<p className="fullscreen-error" role="alert">{fullscreenError}</p>}
    <section className="game-content">
      <h1>Talutmaning</h1>
      <div className="game-numbers">{numbers.map((v,i)=><div key={i}>{v}</div>)}</div>
      <div className="game-target"><span>Måltal</span><strong>{target}</strong></div>
    </section>
  </main>;

  return <main ref={screenRef} className="app"><div className="shell">
    <header><div><small>FRISTÅENDE PROTOTYP</small><h1>Talutmaning</h1><p>Använd alla fem talen exakt en gång och nå måltalet.</p></div><div className="header-actions"><button disabled={!valid} className="primary" onClick={()=>setDisplayMode("game")}><Eye/>Spelläge</button><button onClick={toggleFullscreen}>{isFullscreen?<Minimize/>:<Maximize/>}{isFullscreen?"Avsluta helskärm":"Helskärm"}</button><button onClick={reset}><RefreshCcw/>Rensa</button></div></header>
    {fullscreenError&&<p className="fullscreen-error" role="alert">{fullscreenError}</p>}
    <div className="layout"><section className="panel main-panel">
      <div className="section-head"><div><Calculator/><span><h2>1. Ange talen</h2><p>Fem unika heltal från 1 till 9.</p></span></div><button className="random" onClick={randomize}><Dices/>Slump</button></div>
      <div className="number-inputs">{numbers.map((v,i)=><input key={i} aria-label={`Tal ${i+1}`} inputMode="numeric" value={v} onChange={e=>{if(e.target.value!==""&&!/^\d$/.test(e.target.value))return;const next=[...numbers];next[i]=e.target.value;setNumbers(next);clear()}} placeholder={`${i+1}`}/>)}</div>
      <div className="target-input"><label>Måltal</label><input type="number" min="0" step="1" value={target} onChange={e=>{setTarget(e.target.value);clear()}} placeholder="Mål"/></div>
      <h2>3. Välj nivå</h2><div className="levels">{[1,2,3].map(n=><button className={level===n?"selected":""} key={n} onClick={()=>{setLevel(n);clear()}}><b>Nivå {n}</b><span>{levelText[n]}</span></button>)}</div>
      <label className="toggle"><span><b>Tillåt negativa delresultat</b><small>Exempel: 3 − 5 = −2 får användas på vägen.</small></span><input type="checkbox" checked={allowNegative} onChange={e=>{setAllowNegative(e.target.checked);clear()}}/></label>
      {!valid&&<div className="warning">{validation}</div>}
      <button className="search" disabled={!valid||status==="searching"} onClick={check}><Search/>{status==="searching"?"Söker...":"Kontrollera om en lösning finns"}</button>
    </section>
    <aside><section className="rules"><h2><ShieldCheck/>Aktuella regler</h2><ul><li>De fem talen är unika och används exakt en gång.</li><li>De fyra räknesätten får användas.</li><li>{levelText[level]}.</li><li>Negativa delresultat är {allowNegative?"tillåtna":"inte tillåtna"}.</li><li>Division med noll är aldrig tillåten.</li></ul></section>
    <section className={`results ${status}`}><h2><Lightbulb/>Resultat</h2>{status==="idle"&&<p>Fyll i talen och sök efter lösningar.</p>}{status==="searching"&&<p>Söker systematiskt...</p>}{status==="none"&&<p>Ingen lösning hittades med de valda reglerna.</p>}{status==="found"&&<><b>{solutions.length>=50?"Minst 50 lösningar hittades.":`${solutions.length} lösningar hittades.`}</b><button className="solution-toggle" onClick={()=>setShowSolutions(v=>!v)}><Eye/>{showSolutions?"Dölj lösningar":"Visa lösningar"}</button>{showSolutions&&<><div className="view-buttons"><button onClick={()=>setViewMode("one")}><Eye/>En i taget</button><button onClick={()=>setViewMode("five")}><List/>Visa fem</button></div>{visible.map((s,i)=><div className="solution" key={s.expression+i}><small>{viewMode==="one"?`Lösning ${solutionIndex+1} av ${solutions.length}`:`Lösning ${i+1}`}</small><strong>{s.expression}</strong><b>= {show(s.value)}</b></div>)}{viewMode==="one"&&solutions.length>1&&<div className="pager"><button onClick={()=>setSolutionIndex(i=>(i-1+solutions.length)%solutions.length)}><ChevronLeft/>Föregående</button><button onClick={()=>setSolutionIndex(i=>(i+1)%solutions.length)}>Nästa<ChevronRight/></button></div>}</>}</>}</section></aside></div>
  </div></main>;
}
