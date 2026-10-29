import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

async function debug() {
  const tmpDir = path.join(os.tmpdir(), 'debug_chrome_' + Date.now());
  fs.mkdirSync(tmpDir, { recursive: true });

  const port = 9667;
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    '--disable-gpu',
    '--no-sandbox',
    'http://127.0.0.1:8080/#/'
  ]);

  let wsUrl = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 200));
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (res.ok) {
        const list = await res.json();
        // Pick the page that matches 127.0.0.1:8080
        const page = list.find(p => p.url.includes('8080')) || list[0];
        if (page?.webSocketDebuggerUrl) {
          wsUrl = page.webSocketDebuggerUrl;
          break;
        }
      }
    } catch (e) {}
  }

  console.log('Target WS URL:', wsUrl);
  const ws = new WebSocket(wsUrl);
  await new Promise(r => (ws.onopen = r));

  let msgId = 1;
  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = msgId++;
      const handler = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id === id) {
          ws.removeEventListener('message', handler);
          resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      console.log('CONSOLE:', msg.params.type, msg.params.args.map(a => a.value || a.description || ''));
    } else if (msg.method === 'Runtime.exceptionThrown') {
      console.log('EXCEPTION:', msg.params.exceptionDetails);
    }
  });

  await send('Page.enable');
  await send('Runtime.enable');
  
  await new Promise(r => setTimeout(r, 2000));

  const url = await send('Runtime.evaluate', { expression: 'window.location.href' });
  console.log('Current URL in browser:', url.result?.value);

  const hasApp = await send('Runtime.evaluate', { expression: '!!document.getElementById("app")' });
  console.log('Has #app:', hasApp.result?.value);

  const hasToggles = await send('Runtime.evaluate', { expression: '!!document.getElementById("previewToggles")' });
  console.log('Has #previewToggles:', hasToggles.result?.value);

  const title = await send('Runtime.evaluate', { expression: 'document.title' });
  console.log('Title:', title.result?.value);

  ws.close();
  chrome.kill('SIGKILL');
}

debug().catch(console.error);
