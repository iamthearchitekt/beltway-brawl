const fs = require('fs');

const logPath = 'C:\\Users\\archi\\.gemini\\antigravity\\brain\\d30a5778-9c99-42c3-a7d4-ba4fb668f3a6\\.system_generated\\logs\\transcript_full.jsonl';
const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter(l => l.trim().length > 0);

const filesToRestore = ['src/game/GameEngine.ts', 'src/game/AudioSystem.ts', 'src/components/GameUI.tsx', 'src/App.tsx', 'src/index.css'];

const latestContents = {};

for (const line of lines) {
  try {
    const entry = JSON.parse(line);
    if (entry.tool_calls) {
      for (const call of entry.tool_calls) {
        if (call.tool_name === 'default_api:write_to_file' || call.tool_name === 'default_api:replace_file_content' || call.tool_name === 'default_api:multi_replace_file_content') {
          // If it's a write, we have the full CodeContent
          if (call.tool_name === 'default_api:write_to_file' && call.tool_args.TargetFile) {
             const fp = call.tool_args.TargetFile.replace(/\\/g, '/');
             for(const match of filesToRestore) {
                if (fp.endsWith(match)) {
                   latestContents[match] = { type: 'full', content: call.tool_args.CodeContent };
                }
             }
          }
        }
      }
    }
  } catch(e) {}
}

console.log(Object.keys(latestContents));

for(const [file, data] of Object.entries(latestContents)) {
    console.log(`\n\n--- RESTORED: ${file} ---\n`);
    console.log(data.content ? data.content.substring(0, 500) + '...' : 'NONE');
}
