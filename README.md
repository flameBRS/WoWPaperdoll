# WoW Paper Doll for D&D5e — Foundry VTT v14

A lightweight WoW-inspired equipment paper doll for Foundry VTT **v14** and D&D5e.

## Compatibility
- Foundry VTT: v14
- D&D5e: 5.3+ (including current 6.x)

## Install manually
1. Extract the `wow-paper-doll` folder into your Foundry User Data `Data/modules/` directory.
2. Restart Foundry.
3. Enable **WoW Paper Doll for D&D5e** in Manage Modules.
4. Open a D&D5e character sheet and use **Paper Doll** in the sheet header controls.

## Macro
```js
WoWPaperDoll.open(canvas.tokens.controlled[0]?.actor);
```

## Features
- WoW-inspired equipment layout
- Equipped item artwork
- Head, neck, shoulders, back, chest, wrists, hands, waist, legs, feet
- Two rings and two trinkets
- Main-hand and off-hand slots
- Click an occupied slot to open the item
- Right-click a slot to override its assignment

## Assets
This module does not redistribute Blizzard artwork. Empty slots use Font Awesome silhouettes supplied by Foundry's UI environment.
