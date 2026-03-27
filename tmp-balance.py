from pathlib import Path
p=Path('src/App.tsx')
text=p.read_text(encoding='utf8')
open_braces=0
for i, line in enumerate(text.splitlines(), start=1):
    for c in line:
        if c == '{':
            open_braces += 1
        elif c == '}':
            open_braces -= 1
    if i in (44, 1922):
        print('line', i, 'open', open_braces)
print('final open', open_braces)
