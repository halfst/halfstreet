---
enabled: true
handler: resolve
ladder:
  - steady
  - shaken
  - reeling
  - returning
wrongVerbCost: 1
safeRooms:
  recoverySteps: 1
failure:
  retreatAt: returning
  afterRetreat: shaken
---

# Resolve

The resolve mechanic controls how encounters wear down the player, how safe rooms restore resolve, and which resolve level the player has after an encounter forces a retreat.
