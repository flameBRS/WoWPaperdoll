const MOD = "wow-paper-doll";

const SLOTS = [
  ["head","Head","fa-helmet-safety"],["neck","Neck","fa-gem"],["shoulders","Shoulders","fa-shirt"],
  ["back","Back","fa-person-cape"],["chest","Chest","fa-shirt"],["wrists","Wrists","fa-hand"],
  ["hands","Hands","fa-mitten"],["waist","Waist","fa-ring"],["legs","Legs","fa-person"],["feet","Feet","fa-shoe-prints"],
  ["finger1","Ring","fa-ring"],["finger2","Ring","fa-ring"],["trinket1","Trinket","fa-gem"],["trinket2","Trinket","fa-gem"],
  ["mainhand","Main Hand","fa-sword"],["offhand","Off Hand","fa-shield-halved"]
];

Hooks.once("init", () => {
  game.settings.register(MOD, "showButton", {name:"Show Paper Doll button on character sheets", scope:"client", config:true, type:Boolean, default:true});
});

Hooks.once("ready", () => {
  console.log(`${MOD} | Ready`);
  ui.notifications.info("WoW Paper Doll ready — open a character sheet and click the armor icon.");
});

function isCharacterSheet(app) {
  const actor = app?.actor ?? app?.document;
  return game.system.id === "dnd5e" && actor?.documentName === "Actor" && actor.type === "character";
}

Hooks.on("getHeaderControlsApplicationV2", (app, controls) => {
  if (!game.settings.get(MOD,"showButton") || !isCharacterSheet(app)) return;
  controls.unshift({
    icon: "fa-solid fa-vest",
    label: "Paper Doll",
    action: "wowPaperDoll",
    onClick: () => openPaperDoll(app.actor ?? app.document)
  });
});

Hooks.on("renderApplicationV2", (app, element) => {
  if (!isCharacterSheet(app)) return;
  const root = element instanceof HTMLElement ? element : element?.[0];
  if (!root) return;
  root.querySelectorAll('[data-action="wowPaperDoll"]').forEach(btn => {
    if (btn.dataset.wpdBound) return;
    btn.dataset.wpdBound = "1";
    btn.addEventListener("click", ev => { ev.preventDefault(); openPaperDoll(app.actor ?? app.document); });
  });
});

function equippedItems(actor) {
  return actor.items.filter(i => ["equipment","weapon"].includes(i.type) && i.system?.equipped);
}

function classify(item) {
  if (item.type === "weapon") {
    const props = item.system?.properties;
    const two = props?.has?.("two") || props?.includes?.("two");
    return two ? "mainhand" : "mainhand";
  }
  const t = String(item.system?.type?.value ?? item.system?.armor?.type ?? item.system?.type ?? "").toLowerCase();
  const n = item.name.toLowerCase();
  if (/head|helmet|helm|hat/.test(t+" "+n)) return "head";
  if (/neck|amulet|necklace/.test(t+" "+n)) return "neck";
  if (/shoulder|pauldron/.test(t+" "+n)) return "shoulders";
  if (/cloak|back|cape/.test(t+" "+n)) return "back";
  if (/shield/.test(t+" "+n)) return "offhand";
  if (/ring/.test(t+" "+n)) return "finger1";
  if (/trinket|wondrous/.test(t+" "+n)) return "trinket1";
  if (/hand|glove|gauntlet/.test(t+" "+n)) return "hands";
  if (/boot|shoe|feet/.test(t+" "+n)) return "feet";
  if (/belt|waist/.test(t+" "+n)) return "waist";
  if (/leg|pants|greave/.test(t+" "+n)) return "legs";
  if (/wrist|bracer/.test(t+" "+n)) return "wrists";
  if (/armor|light|medium|heavy|clothing|chest/.test(t+" "+n)) return "chest";
  return "trinket1";
}

function assign(actor) {
  const map = {};
  for (const item of equippedItems(actor)) {
    let slot = item.getFlag(MOD,"slot") || classify(item);
    if (map[slot]) {
      if (slot === "finger1" && !map.finger2) slot="finger2";
      else if (slot === "trinket1" && !map.trinket2) slot="trinket2";
      else if (slot === "mainhand" && !map.offhand) slot="offhand";
    }
    if (!map[slot]) map[slot]=item;
  }
  return map;
}

async function setSlot(actor,item,slot) {
  if (!actor.isOwner) return ui.notifications.warn("You do not own this actor.");
  await item.setFlag(MOD,"slot",slot);
  openPaperDoll(actor);
}

function slotHTML(slot,label,icon,item) {
  const content = item ? `<img src="${item.img}"/><span>${foundry.utils.escapeHTML(item.name)}</span>` : `<i class="fa-solid ${icon}"></i><span>${label}</span>`;
  return `<div class="wpd-slot ${item?'filled':''}" data-slot="${slot}" ${item?`data-item-id="${item.id}"`:''} title="${label}${item?`: ${foundry.utils.escapeHTML(item.name)}`:''}">${content}</div>`;
}

function buildHTML(actor) {
  const m=assign(actor), s=Object.fromEntries(SLOTS.map(x=>[x[0],slotHTML(...x,m[x[0]])]));
  return `<div class="wpd-wrap" data-actor-id="${actor.id}">
    <div class="wpd-title">${foundry.utils.escapeHTML(actor.name)}</div>
    <div class="wpd-board">
      <div class="wpd-left">${s.head}${s.neck}${s.shoulders}${s.back}${s.chest}${s.wrists}${s.hands}${s.waist}${s.legs}${s.feet}</div>
      <div class="wpd-center"><img class="wpd-portrait" src="${actor.img}"/><div class="wpd-hint">Click an equipped item to open it.<br>Right-click a slot to choose which equipped item belongs there.</div></div>
      <div class="wpd-right">${s.finger1}${s.finger2}${s.trinket1}${s.trinket2}</div>
    </div>
    <div class="wpd-weapons">${s.mainhand}${s.offhand}</div>
  </div>`;
}

function bind(root, actor) {
  root.querySelectorAll(".wpd-slot").forEach(el=>{
    el.addEventListener("click",()=>{
      const id=el.dataset.itemId; if(id) actor.items.get(id)?.sheet?.render(true);
    });
    el.addEventListener("contextmenu", async ev=>{
      ev.preventDefault();
      if(!actor.isOwner) return;
      const items=equippedItems(actor);
      const options=items.map(i=>`<option value="${i.id}">${foundry.utils.escapeHTML(i.name)}</option>`).join("");
      const slot=el.dataset.slot;
      const content=`<p>Assign an equipped item to <b>${SLOTS.find(x=>x[0]===slot)?.[1]??slot}</b>.</p><select id="wpd-pick" style="width:100%"><option value="">— Clear override —</option>${options}</select>`;
      const DialogV2=foundry.applications?.api?.DialogV2;
      if(DialogV2) {
        const result=await DialogV2.wait({window:{title:"Paper Doll Slot"},content,buttons:[{action:"ok",label:"Assign",default:true},{action:"cancel",label:"Cancel"}]});
        if(result==="ok") { const id=document.querySelector("#wpd-pick")?.value; if(id) await setSlot(actor,actor.items.get(id),slot); }
      } else new Dialog({title:"Paper Doll Slot",content,buttons:{ok:{label:"Assign",callback:html=>{const id=html.find("#wpd-pick").val(); if(id)setSlot(actor,actor.items.get(id),slot);}},cancel:{label:"Cancel"}}}).render(true);
    });
  });
}

async function openPaperDoll(actor) {
  if (!actor) return;
  document.querySelector(".wpd-window")?.closest(".window-app, .application")?.remove();
  const DialogV2=foundry.applications?.api?.DialogV2;
  if(DialogV2) {
    const dlg=new DialogV2({window:{title:`${actor.name} — Paper Doll`,classes:["wpd-window"]},content:buildHTML(actor),buttons:[{action:"close",label:"Close"}]});
    await dlg.render(true);
    setTimeout(()=>{const root=document.querySelector(".wpd-window"); if(root)bind(root,actor);},50);
  } else {
    new Dialog({title:`${actor.name} — Paper Doll`,content:buildHTML(actor),buttons:{close:{label:"Close"}},render:html=>bind(html[0],actor)},{classes:["wpd-window"],width:620}).render(true);
  }
}

globalThis.WoWPaperDoll={open:openPaperDoll};
