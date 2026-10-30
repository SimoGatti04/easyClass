#!/usr/bin/env python3
"""Verifica del bundle di validazione.

Nel mirror pubblico il corpus didattico reale e i suoi derivati non sono distribuiti:
in quel caso lo script verifica la struttura pubblica e dichiara `DATA WITHHELD`
invece di fallire. Se il corpus è presente (copia privata), verifica anche i checksum.
"""
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
    'corpus/SOURCES.md',
    'results/B0-runtime-report.md','results/README.md'
]
corpus_required = [
    'corpus/source/SHA256SUMS.txt','corpus/source/MANIFEST.json',
    'corpus/source/dbms-sql/dbms_teacher_script.pdf',
    'corpus/source/dbms-sql/dbms_student_lesson.pdf',
    'corpus/source/cybersecurity/cyber_teacher_script.pdf',
    'corpus/source/history/history_teacher.docx',
    'corpus/source/excel/excel_teacher.docx',
    'corpus/source/excel/excel_demo.xlsx',
]

missing=[p for p in required if not (root/p).is_file()]
if missing:
    print('VALIDATION_BUNDLE: FAIL')
    print('Missing:')
    for p in missing: print(' -',p)
    sys.exit(1)

corpus_missing=[p for p in corpus_required if not (root/p).is_file()]
if corpus_missing:
    declares = (root.parent/'PUBLICATION.md').is_file() and 'WITHHELD' in (root/'corpus/SOURCES.md').read_text()
    if not declares:
        print('VALIDATION_BUNDLE: FAIL')
        print('Corpus assente senza dichiarazione di withholding:')
        for p in corpus_missing: print(' -',p)
        sys.exit(3)
    print('VALIDATION_BUNDLE: DATA WITHHELD (public mirror)')
    print(f'Required public files: {len(required)}/{len(required)} PASS')
    print(f'Corpus sets withheld: {len(corpus_missing)} file, checksum verification skipped by policy')
    sys.exit(0)

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
print(f'Required files: {len(required)+len(corpus_required)}')
print(f'Corpus checksums: {len(checksums)}/{len(checksums)} PASS')
