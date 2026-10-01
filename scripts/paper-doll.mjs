const MOD = "wow-paper-doll";
const VERSION = "0.4.1";
const A = `modules/${MOD}/assets/slots`;

const SLOTS = [
  ["head","Head",`${A}/Ui-paperdoll-slot-head.png`],
  ["neck","Neck",`${A}/Ui-paperdoll-slot-neck.webp`],
  ["shoulders","Shoulders",`${A}/Ui-paperdoll-slot-shoulder.png`],
  ["back","Back",`${A}/Ui-backpack-emptyslot.png`],
  ["chest","Chest",`${A}/Ui-paperdoll-slot-chest.webp`],
  ["shirt","Shirt",`${A}/Ui-paperdoll-slot-shirt.png`],
  ["wrists","Wrists",`${A}/Ui-paperdoll-slot-wrists.png`],
  ["hands","Hands",`${A}/Ui-paperdoll-slot-hands.webp`],
  ["waist","Waist",`${A}/Ui-paperdoll-slot-waist.png`],
  ["legs","Legs",`${A}/Ui-paperdoll-slot-legs.png`],
  ["feet","Feet",`${A}/Ui-paperdoll-slot-feet.webp`],
  ["finger1","Ring",`${A}/Ui-paperdoll-slot-finger.webp`],
  ["finger2","Ring",`${A}/Ui-paperdoll-slot-finger.webp`],
  ["trinket1","Trinket",`${A}/Ui-paperdoll-slot-trinket.webp`],
  ["trinket2","Trinket",`${A}/Ui-paperdoll-slot-trinket.webp`],
  ["mainhand","Main Hand",`${A}/Ui-paperdoll-slot-mainhand.webp`],
  ["offhand","Off Hand",`${A}/Ui-paperdoll-slot-secondaryhand.png`],
  ["ranged","Ranged",`${A}/Ui-paperdoll-slot-ranged.webp`],
  ["ammo","Ammo",`${A}/Ui-paperdoll-slot-ammo.png`]
];
const SLOT_MAP = Object.fromEntries(SLOTS.map(([id,label,img]) => [id,{label,img}]));
const LEFT = ["head","neck","shoulders","back","chest","shirt","wrists"];
const RIGHT = ["hands","waist","legs","feet","finger1","finger2","trinket1","trinket2"];
const BOTTOM = ["mainhand","offhand","ranged","ammo"];

Hooks.once("init", () => {
  game.settings.register(MOD,"showButton",{name:"Show Paper Doll button on character sheets",hint:"Adds a Paper Doll button to D&D5e character sheets.",scope:"client",config:true,type:Boolean,default:true});
  game.settings.register(MOD,"autoOpen",{name:"Automatically open Paper Doll with character sheet",hint:"When you open a D&D5e character sheet, its Paper Doll opens automatically. One Paper Doll window is kept per actor.",scope:"client",config:true,type:Boolean,default:false});
});
Hooks.once("ready", () => console.log(`${MOD} | v${VERSION} ready`));

function actorOf(app){ return app?.actor ?? app?.document; }
function isCharacterSheet(app){ const a=actorOf(app); return game.system.id==="dnd5e" && a?.documentName==="Actor" && a.type==="character"; }

Hooks.on("getHeaderControlsApplicationV2",(app,controls)=>{
  if(!game.settings.get(MOD,"showButton") || !isCharacterSheet(app)) return;
  controls.unshift({icon:"fa-solid fa-vest",label:"Paper Doll",action:"wowPaperDoll",onClick:()=>openPaperDoll(actorOf(app))});
});
Hooks.on("renderApplicationV2",(app,element)=>{
  if(!isCharacterSheet(app)) return;
  const actor=actorOf(app);
  const root=element instanceof HTMLElement ? element : element?.[0];
  root?.querySelectorAll('[data-action="wowPaperDoll"]').forEach(btn=>{
    if(btn.dataset.wpdBound) return; btn.dataset.wpdBound="1";
    btn.addEventListener("click",ev=>{ev.preventDefault(); openPaperDoll(actor);});
  });
  if(game.settings.get(MOD,"autoOpen") && !autoOpenedSheets.has(app)){
    autoOpenedSheets.add(app);
    openPaperDoll(actor,{focusExisting:false});
  }
});
const autoOpenedSheets=new WeakSet();

function equippedItems(actor){ return actor.items.filter(i=>["equipment","weapon"].includes(i.type) && i.system?.equipped); }
function classify(item){
  if(item.type==="weapon") return /bow|crossbow|sling|firearm|ranged/i.test(`${item.name} ${item.system?.type?.value??""}`)?"ranged":"mainhand";
  const t=String(item.system?.type?.value ?? item.system?.armor?.type ?? item.system?.type ?? "").toLowerCase();
  const q=`${t} ${item.name}`.toLowerCase();
  if(/head|helmet|helm|hat/.test(q)) return "head"; if(/neck|amulet|necklace/.test(q)) return "neck";
  if(/shoulder|pauldron/.test(q)) return "shoulders"; if(/cloak|cape|back/.test(q)) return "back";
  if(/shirt/.test(q)) return "shirt"; if(/shield/.test(q)) return "offhand"; if(/ring/.test(q)) return "finger1";
  if(/trinket|wondrous/.test(q)) return "trinket1"; if(/hand|glove|gauntlet/.test(q)) return "hands";
  if(/boot|shoe|feet/.test(q)) return "feet"; if(/belt|waist/.test(q)) return "waist"; if(/leg|pants|greave/.test(q)) return "legs";
  if(/wrist|bracer/.test(q)) return "wrists"; if(/armor|light|medium|heavy|clothing|chest/.test(q)) return "chest";
  return "trinket1";
}
function assign(actor){
  const map={};
  for(const item of equippedItems(actor)){
    let slot=item.getFlag(MOD,"slot") || classify(item);
    const alternates={finger1:"finger2",trinket1:"trinket2",mainhand:"offhand"};
    if(map[slot] && alternates[slot] && !map[alternates[slot]]) slot=alternates[slot];
    if(!map[slot]) map[slot]=item;
  }
  return map;
}
async function setSlot(actor,item,slot){
  if(!actor.isOwner) return ui.notifications.warn("You do not own this actor.");
  for(const other of actor.items) if(other.id!==item.id && other.getFlag(MOD,"slot")===slot) await other.unsetFlag(MOD,"slot");
  await item.setFlag(MOD,"slot",slot); await refresh(actor);
}
async function clearSlot(actor,slot){ for(const item of actor.items) if(item.getFlag(MOD,"slot")===slot) await item.unsetFlag(MOD,"slot"); await refresh(actor); }
function customIcons(actor){ return actor.getFlag(MOD,"slotIcons") ?? {}; }
async function setSlotIcon(actor,slot,path){ const icons={...customIcons(actor)}; if(path) icons[slot]=path; else delete icons[slot]; await actor.setFlag(MOD,"slotIcons",icons); await refresh(actor); }

function slotHTML(actor,slot,item){
  const meta=SLOT_MAP[slot]; const emptyImg=customIcons(actor)[slot] || meta.img;
  const content=item ? `<img class="wpd-item-img" src="${item.img}"><span>${foundry.utils.escapeHTML(item.name)}</span>` : `<img class="wpd-empty-img" src="${emptyImg}">`;
  return `<div class="wpd-slot ${item?'filled':''}" data-slot="${slot}" ${item?`data-item-id="${item.id}"`:''} title="${meta.label}${item?`: ${foundry.utils.escapeHTML(item.name)}`:''}">${content}</div>`;
}
function buildHTML(actor){
  const m=assign(actor); const s=Object.fromEntries(SLOTS.map(([id])=>[id,slotHTML(actor,id,m[id])]));
  return `<div class="wpd-wrap" data-actor-id="${actor.id}">
    <div class="wpd-title">${foundry.utils.escapeHTML(actor.name)}</div>
    <div class="wpd-board">
      <div class="wpd-side wpd-left">${LEFT.map(x=>s[x]).join("")}</div>
      <div class="wpd-center"><img class="wpd-portrait" src="${actor.img}"><div class="wpd-hint">Left-click an equipped item to open it.<br><b>Right-click a slot</b> to assign an item or change its icon.</div></div>
      <div class="wpd-side wpd-right">${RIGHT.map(x=>s[x]).join("")}</div>
    </div>
    <div class="wpd-bottom">${BOTTOM.map(x=>s[x]).join("")}</div>
  </div>`;
}

async function showItemPicker(actor,slot){
  const DialogV2=foundry.applications.api.DialogV2; const items=equippedItems(actor);
  const rows=items.length?items.map(i=>`<button type="button" class="wpd-item-choice" data-item-id="${i.id}"><img src="${i.img}"><span>${foundry.utils.escapeHTML(i.name)}</span></button>`).join(""):`<p>No equipped weapons or equipment found.</p>`;
  const dlg=new DialogV2({window:{title:`Choose ${SLOT_MAP[slot].label}`},content:`<div class="wpd-picker-list">${rows}<button type="button" class="wpd-clear-slot"><i class="fa-solid fa-eraser"></i> Clear manual assignment</button></div>`,buttons:[{action:"close",label:"Cancel"}]});
  await dlg.render(true); const root=dlg.element;
  root.querySelectorAll(".wpd-item-choice").forEach(b=>b.addEventListener("click",async()=>{await setSlot(actor,actor.items.get(b.dataset.itemId),slot); await dlg.close();}));
  root.querySelector(".wpd-clear-slot")?.addEventListener("click",async()=>{await clearSlot(actor,slot); await dlg.close();});
}
async function chooseIcon(actor,slot){
  const FP=foundry.applications.apps.FilePicker; const current=customIcons(actor)[slot] || SLOT_MAP[slot].img;
  new FP({type:"image",current,callback:async path=>setSlotIcon(actor,slot,path)}).render(true);
}
async function showSlotMenu(actor,slot){
  if(!actor.isOwner) return ui.notifications.warn("You do not own this actor.");
  const DialogV2=foundry.applications.api.DialogV2; const hasCustom=!!customIcons(actor)[slot];
  const dlg=new DialogV2({window:{title:`${SLOT_MAP[slot].label} — Paper Doll`},content:`<div class="wpd-slot-menu">
    <button type="button" data-wpd-menu="item"><i class="fa-solid fa-list"></i> Choose equipped item</button>
    <button type="button" data-wpd-menu="icon"><i class="fa-solid fa-image"></i> Change slot icon</button>
    <button type="button" data-wpd-menu="reset" ${hasCustom?'':'disabled'}><i class="fa-solid fa-rotate-left"></i> Reset to WoW icon</button>
  </div>`,buttons:[{action:"close",label:"Close"}]});
  await dlg.render(true); const root=dlg.element;
  root.querySelector('[data-wpd-menu="item"]')?.addEventListener("click",async()=>{await dlg.close(); await showItemPicker(actor,slot);});
  root.querySelector('[data-wpd-menu="icon"]')?.addEventListener("click",async()=>{await dlg.close(); await chooseIcon(actor,slot);});
  root.querySelector('[data-wpd-menu="reset"]')?.addEventListener("click",async()=>{await setSlotIcon(actor,slot,null); await dlg.close();});
}
function bind(root,actor){ root.querySelectorAll(".wpd-slot").forEach(el=>{ el.addEventListener("click",()=>{const id=el.dataset.itemId;if(id)actor.items.get(id)?.sheet?.render(true);}); el.addEventListener("contextmenu",ev=>{ev.preventDefault();ev.stopPropagation();showSlotMenu(actor,el.dataset.slot);}); }); }

const activeDialogs=new Map();
async function refresh(actor){ const old=activeDialogs.get(actor.uuid); if(old){try{await old.close();}catch{}} activeDialogs.delete(actor.uuid); await openPaperDoll(actor,{focusExisting:false}); }
async function openPaperDoll(actor,{focusExisting=true}={}){
  if(!actor) return;
  const existing=activeDialogs.get(actor.uuid);
  if(existing){ if(focusExisting){try{existing.bringToFront?.();}catch{}} return existing; }
  const DialogV2=foundry.applications.api.DialogV2;
  const dlg=new DialogV2({window:{title:`${actor.name} — Paper Doll`,classes:["wpd-window"]},content:buildHTML(actor),buttons:[{action:"close",label:"Close"}]});
  activeDialogs.set(actor.uuid,dlg); await dlg.render(true); bind(dlg.element,actor);
  const originalClose=dlg.close.bind(dlg); dlg.close=async(...args)=>{activeDialogs.delete(actor.uuid);return originalClose(...args);};
  return dlg;
}
globalThis.WoWPaperDoll={open:openPaperDoll};
