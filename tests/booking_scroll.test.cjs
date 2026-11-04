const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const sourceFile=path.join(__dirname,'../site/booking-scroll.js');
const source=fs.existsSync(sourceFile)?fs.readFileSync(sourceFile,'utf8'):'';

function hub(){
 const listeners=new Map();
 return {addEventListener(k,f){if(!listeners.has(k))listeners.set(k,new Set());listeners.get(k).add(f)},removeEventListener(k,f){listeners.get(k)?.delete(f)},fire(k,e={}){e.type=k;for(const f of [...(listeners.get(k)||[])])f(e)}};
}
function boot(options={}){
 const env={y:0,bookingY:3000,height:81,docHeight:7000,calls:[],pushes:[],observers:[],frames:new Map(),timers:new Map(),next:0,...options};
 const win=hub(),doc=hub();
 win.location=new URL('https://docbratus.ru'+(options.path||'/')+(options.hash||''));
 const root={scrollHeight:env.docHeight},body={scrollHeight:env.docHeight};
 const booking={getBoundingClientRect:()=>({top:env.bookingY-env.y})},header={getBoundingClientRect:()=>({bottom:env.height})},reviews={};
 doc.documentElement=root;doc.body=body;doc.readyState='complete';
 doc.getElementById=id=>id==='booking'&&!env.absent?booking:id==='reviews'?reviews:null;
 doc.querySelector=q=>q==='.db-header'?header:q==='#booking'&&!env.absent?booking:null;
 win.document=doc;win.innerHeight=720;Object.defineProperty(win,'scrollY',{get:()=>env.y});
 win.history={state:null,pushState(state,unused,url){env.pushes.push(url);win.location=new URL(url,win.location)}};
 win.matchMedia=()=>({matches:!!env.reduced});
 win.scrollTo=o=>{env.calls.push(o);env.y=o.top};
 win.requestAnimationFrame=f=>{const id=++env.next;env.frames.set(id,f);return id};
 win.cancelAnimationFrame=id=>env.frames.delete(id);
 win.setTimeout=f=>{const id=++env.next;env.timers.set(id,f);return id};
 win.clearTimeout=id=>env.timers.delete(id);
 class Observer{constructor(f){this.f=f;this.active=true;env.observers.push(this)}observe(){}disconnect(){this.active=false}}
 if(!env.noResizeObserver)win.ResizeObserver=Observer;win.MutationObserver=Observer;
 vm.runInNewContext(source,{window:win,document:doc,URL,Math,Number,Boolean});
 env.flush=()=>{for(let n=0;env.frames.size&&n<8;n++){const pending=[...env.frames.values()];env.frames.clear();pending.forEach(f=>f())}assert.equal(env.frames.size,0)};
 env.resize=delta=>{env.bookingY+=delta;env.docHeight+=delta;root.scrollHeight=body.scrollHeight=env.docHeight;for(const o of env.observers)if(o.active)o.f([]);};
 env.click=(href='index.html#booking',extra={})=>{const anchor={href:new URL(href,win.location).href,target:'',getAttribute:k=>k==='href'?href:null,hasAttribute:()=>false,...extra.anchor};const event={button:0,defaultPrevented:false,target:{closest:()=>anchor},preventDefault(){this.defaultPrevented=true},...extra};doc.fire('click',event);return event};
 env.win=win;env.doc=doc;env.expire=()=>{const callbacks=[...env.timers.values()];env.timers.clear();callbacks.forEach(f=>f())};
 env.flush();return env;
}

test('same-home booking click reaches target without a document navigation',()=>{
 const e=boot();const event=e.click();e.flush();assert.equal(event.defaultPrevented,true);assert.equal(e.win.location.pathname,'/');assert.equal(e.win.location.hash,'#booking');assert.equal(e.y,2907);
});
test('direct hash is corrected after the late reviews expand by 2712px',()=>{
 const e=boot({hash:'#booking'});assert.equal(e.y,2907);e.resize(2712);e.flush();assert.equal(e.y,5619);assert.equal(e.calls.at(-1).behavior,'instant');
});
test('unchanged observer delivery does not interrupt initial smooth scrolling',()=>{
 const e=boot({hash:'#booking'}),count=e.calls.length;assert.equal(count,1,'Initial navigation must scroll once');e.resize(0);e.flush();assert.equal(e.calls.length,count);assert.equal(e.calls[0].behavior,'smooth');
});
test('resize bursts coalesce to the latest geometry and header offset',()=>{
 const e=boot({hash:'#booking'}),count=e.calls.length;e.resize(100);e.resize(200);e.height=65;e.flush();assert.equal(e.y,3223);assert.equal(e.calls.length,count+1);
});
test('reduced motion skips the initial smooth animation',()=>{
 const e=boot({hash:'#booking',reduced:true});assert.equal(e.y,2907);assert.equal(e.calls[0].behavior,'instant');
});
for(const [event,value]of[['wheel',{}],['touchstart',{}],['pointerdown',{}],['keydown',{key:'PageUp'}]])test('manual '+event+' ends alignment instead of pulling the reader back',()=>{
 const e=boot({hash:'#booking'});assert.equal(e.y,2907);e.win.fire(event,value);const count=e.calls.length;e.resize(1000);e.flush();assert.equal(e.calls.length,count);
});
test('ordinary typing does not count as manual scrolling',()=>{
 const e=boot({hash:'#booking'});e.win.fire('keydown',{key:'a'});e.resize(100);e.flush();assert.equal(e.y,3007);
});
test('navigation away from booking cancels the pending correction',()=>{
 const e=boot({hash:'#booking'});e.win.location.hash='#reviews';e.win.fire('hashchange');const count=e.calls.length;e.resize(1000);e.flush();assert.equal(e.calls.length,count);
});
test('modified or external links retain native browser behavior',()=>{
 const e=boot();assert.equal(e.click('index.html#booking',{ctrlKey:true}).defaultPrevented,false);assert.equal(e.click('https://example.com/#booking').defaultPrevented,false);assert.equal(e.click('#reviews').defaultPrevented,false);assert.equal(e.click('#booking',{anchor:{target:'_blank'}}).defaultPrevented,false);e.flush();assert.equal(e.calls.length,0);assert.equal(e.pushes.length,0);
});
test('expired navigation stops observing later layout changes',()=>{
 const e=boot({hash:'#booking'});assert.equal(e.y,2907);e.expire();const count=e.calls.length;e.resize(1000);e.flush();assert.equal(e.calls.length,count);assert.equal(e.observers.filter(o=>o.active).length,0);
});
test('MutationObserver fallback still follows a late widget without ResizeObserver',()=>{
 const e=boot({hash:'#booking',noResizeObserver:true});e.resize(1000);e.flush();assert.equal(e.y,3907);
});
test('pages without booking are left alone',()=>{
 const e=boot({hash:'#booking',absent:true});assert.equal(e.calls.length,0);assert.equal(e.observers.length,0);
});
