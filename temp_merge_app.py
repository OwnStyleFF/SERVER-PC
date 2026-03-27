from pathlib import Path
backup_path = Path('C:/Users/AndresGC/Downloads/App.tsx')
current_path = Path('src/App.tsx')
backup = backup_path.read_text(encoding='utf-8').splitlines()
current = current_path.read_text(encoding='utf-8').splitlines()
start_marker = '  const [isDigitalServicesModalOpen, setIsDigitalServicesModalOpen] = useState(false);'
end_marker = '  const renderRentalModal = () => {'
start_b = next(i for i,l in enumerate(backup) if start_marker in l)
end_b = next(i for i,l in enumerate(backup) if end_marker in l)
start_c = next(i for i,l in enumerate(current) if start_marker in l)
end_c = next(i for i,l in enumerate(current) if end_marker in l)
print('backup start end', start_b, end_b)
print('current start end', start_c, end_c)
final = backup[:start_b] + current[start_c:end_c] + backup[end_b:]
Path('src/App.tsx').write_text('\n'.join(final) + '\n', encoding='utf-8')
print('Merged file written.')
