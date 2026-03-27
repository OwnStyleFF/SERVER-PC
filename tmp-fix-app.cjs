const fs = require('fs');
const p = 'src/App.tsx';
let c = fs.readFileSync(p, 'utf8');
const st = 'function ProgressBar({ label, value, color }: { label: string; value: number; color: string }) {';
const en = '\nfunction SidebarItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {';
const si = c.indexOf(st);
const ei = c.indexOf(en, si);
if (si === -1 || ei === -1) {
  console.error('markers not found', si, ei);
  process.exit(1);
}
const before = c.slice(0, si);
const after = c.slice(ei);
const replacement = `function ProgressBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-black uppercase tracking-widest">
        <span className="text-gray-400">{label}</span>
        <span className="text-gray-800">{value.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: String(value) + '%' }}
          className={"h-full " + color}
        />
      </div>
    </div>
  );
}
`;
fs.writeFileSync(p, before + replacement + after, 'utf8');
console.log('done');
