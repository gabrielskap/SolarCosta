import 'dotenv/config';
import { config } from 'dotenv';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
config({path:path.join(root,'server/.env')});
if(!process.env.TELHADO_IA_TOKEN||process.env.TELHADO_IA_TOKEN.length<32)throw new Error('Configure TELHADO_IA_TOKEN em server/.env (mínimo 32 caracteres).');
const venv=path.join(root,'services/telhado-ia/.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
const python=process.env.TELHADO_IA_PYTHON||(existsSync(venv)?venv:process.platform==='win32'?'python':'python3');
const url=new URL(process.env.TELHADO_IA_URL||'http://127.0.0.1:8000');
if(!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('O comando de desenvolvimento só inicia um serviço em loopback.');
const child=spawn(python,['server.py'],{cwd:path.join(root,'services/telhado-ia'),stdio:'inherit',windowsHide:true,
  env:{...process.env,BIND:'127.0.0.1',PORT:url.port||'8000'}});
child.on('error',e=>{console.error('Não foi possível iniciar o Python da IA:',e.message);process.exitCode=1;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill());
child.on('exit',code=>{process.exitCode=code??0;});
