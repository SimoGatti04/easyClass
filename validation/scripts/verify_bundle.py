#!/usr/bin/env python3
from pathlib import Path
import hashlib, sys

root = Path(__file__).resolve().parents[1]
required = [
    'README.md','LAUNCH_MATRIX.md',
    'shared/COMMON_RULES.md','shared/REPORT_TEMPLATE.md','shared/SCORING.md','shared/PROJECT_PATHS.md',
    'roles/validation-engineer.md','roles/retrieval-knowledge-engineer.md','roles/model-evaluation-engineer.md',
    'roles/decision-systems-engineer.md','roles/integration-reliability-engineer.md','roles/technical-auditor.md',
    'tasks/B0-runtime.md','tasks/B1-parsing.md','tasks/B2-retrieval.md','tasks/B3-models.md','tasks/B4-decisions.md',
    'tasks/B5-B6-integration.md','tasks/FINAL-feasibility.md',
    'corpus/SOURCES.md','corpus/source/SHA256SUMS.txt','corpus/source/MANIFEST.json',
    'corpus/source/dbms-sql/dbms_teacher_script.pdf',
    'corpus/source/dbms-sql/dbms_student_lesson.pdf',
    'corpus/source/cybersecurity/cyber_teacher_script.pdf',
    'corpus/source/history/history_teacher.docx',
    'corpus/source/excel/excel_teacher.docx',
    'corpus/source/excel/excel_demo.xlsx',
    'results/B0-runtime-report.md','results/README.md'
]
missing=[p for p in required if not (root/p).is_file()]
if missing:
    print('VALIDATION_BUNDLE: FAIL')
    print('Missing:')
    for p in missing: print(' -',p)
    sys.exit(1)

checksums={}
for line in (root/'corpus/source/SHA256SUMS.txt').read_text().splitlines():
    if not line.strip(): continue
    h, rel = line.split(None,1)
    checksums[rel.strip()] = h
bad=[]
for rel, expected in checksums.items():
    p=root/'corpus/source'/rel
    if not p.is_file(): bad.append((rel,'missing'))
    else:
        got=hashlib.sha256(p.read_bytes()).hexdigest()
        if got != expected: bad.append((rel,f'hash mismatch {got}'))
if bad:
    print('VALIDATION_BUNDLE: FAIL')
    for rel,msg in bad: print(f' - {rel}: {msg}')
    sys.exit(2)

print('VALIDATION_BUNDLE: PASS')
print(f'Required files: {len(required)}')
print(f'Corpus checksums: {len(checksums)}/6 PASS')
