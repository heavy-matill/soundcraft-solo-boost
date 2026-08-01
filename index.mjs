import { SoundcraftUI } from 'soundcraft-ui-connection';

const conn = new SoundcraftUI('ui.io');
await conn.connect();

setInterval(() => {
  conn.master.input(2).toggleMute();
}, 1000);