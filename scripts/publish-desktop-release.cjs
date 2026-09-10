// Reuse the repository's configured Git credential helper without printing credentials.
const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const result = spawnSync('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\npath=Maddyharry/dischargex.git\n\n', encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
const fields = Object.fromEntries((result.stdout || '').split('\n').filter(line => line.includes('=')).map(line => { const i=line.indexOf('='); return [line.slice(0,i),line.slice(i+1)]; }));
if (result.status !== 0 || !fields.password) { console.error('Repository authentication is unavailable.'); process.exit(1); }
const env = { ...process.env, GH_TOKEN: fields.password, GH_PROMPT_DISABLED: '1' };
function gh(args) { const r=spawnSync('gh', args, { encoding:'utf8', env }); if(r.stdout) process.stdout.write(r.stdout); if(r.status!==0) { console.error((r.stderr||'GitHub operation failed.').split(fields.password).join('[redacted]')); process.exit(r.status||1); } }
const repository = 'Maddyharry/dischargex';
if (process.argv[2] !== '--publish') { gh(['api', `repos/${repository}/releases`, '--jq', '.[] | {tag_name,draft,prerelease,assets:[.assets[].name]}']); process.exit(0); }
const archive = 'C:/Users/narac/Downloads/DischargeX_Automator/artifacts/DischargeX_Windows_v0.12.9.zip';
const notes = 'C:/Users/narac/Downloads/DischargeX_Automator/RELEASE_0.12.9.md';
if (!existsSync(archive) || !existsSync(notes)) throw new Error('Release files missing');
gh(['release','create','v0.12.9',archive,'--repo',repository,'--target','main','--title','DischargeX Desktop 0.12.9','--notes-file',notes]);
