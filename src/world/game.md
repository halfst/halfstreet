---
id: halfstreet
title: Halfstreet
description: A gothic mystery.
startingRoom: "[[outside-gate]]"
startingInventory:
  - "[[letter]]"
  - "[[matches]]"
  - "[[broken-cigarette]]"
endingPriority:
  - mercy
  - "true"
  - replacement
  - bad
  - wrong
transcriptCap: 200
---

## opening-art
 _   _       _  __     ____  _                 _
| | | | __ _| |/ _|   / ___|| |_ _ __ ___  ___| |_
| |_| |/ _` | | |_    \___ \| __| '__/ _ \/ _ \ __|
|  _  | (_| | |  _|    ___) | |_| | |  __/  __/ |_
|_| |_|\__,_|_|_|     |____/ \__|_|  \___|\___|\__|

## help
You arrive at the address, but you do not remember what has happened. The road behind you is gone...

This is a text adventure. Type short commands to act in the house.

Common commands:
look                    describe the room again
n, s, e, w, u, d        move by direction
take lamp               pick something up
examine letter          inspect something nearby or held
read letter             read a readable object
inventory               see what you carry
light lamp with matches use one thing with another
wait                    let the room continue
undo                    step back once
restart                 begin again
theme                   change the terminal colors

Most commands are verb first, then the thing: examine gate, take lamp, use key on door.

## ended
The story has ended. Type `restart` or `undo`.
