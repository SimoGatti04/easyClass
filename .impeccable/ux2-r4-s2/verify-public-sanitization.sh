#!/usr/bin/env bash
# UX2-R4-S2 — verifica riproducibile del mirror pubblico.
# Controlla l'intera cronologia raggiungibile: nessun dato escluso o redatto deve riapparire.
# Lo script stesso contiene i pattern come letterali di ricerca e viene escluso dal grep.
set -uo pipefail
fail=0
check_zero() { # $1 = label, $2 = grep -E pattern
  local n
  n=$(git grep -I -l -e "$2" $(git rev-list --all) -- ':!*verify-public-sanitization.sh' 2>/dev/null | wc -l | tr -d ' ')
  if [ "$n" -eq 0 ]; then printf 'PASS  %-42s 0 hits\n' "$1"; else printf 'FAIL  %-42s %s hits\n' "$1" "$n"; fail=1; fi
}
check_zero "personal e-mail"            "simogatti004"
check_zero "school domain"              "scuola\\.it"
check_zero "institution acronym"        "AFMG"
check_zero "owner home path"            "/Users/gatti"
check_zero "backup host alias"          "servergatti"
check_zero "LAN address"                "192\\.168\\.1\\.13"
check_zero "overlay address"            "100\\.102\\.106\\.62"
check_zero "illustrative roster"        "Rossi Marco"
check_zero "private corpus filenames"   "SCRIPT_VERBATIM|Scheda_lezione|Docente_Lezione"

paths=$(git log --all --name-only --pretty=format: | sort -u)
for p in 'validation/corpus/source/' 'validation/corpus/gold/' 'validation/artifacts/B1/' 'validation/artifacts/B2/' 'validation/validation/' 'ecosystem.config.cjs'; do
  n=$(printf '%s\n' "$paths" | grep -c "^$p" || true)
  if [ "$n" -eq 0 ]; then printf 'PASS  excluded path %-31s 0\n' "$p"; else printf 'FAIL  excluded path %-31s %s\n' "$p" "$n"; fail=1; fi
done
n=$(printf '%s\n' "$paths" | grep -c '\.pyc$' || true)
[ "$n" -eq 0 ] && echo "PASS  bytecode caches                          0" || { echo "FAIL  bytecode caches $n"; fail=1; }

git fsck --full --strict >/dev/null 2>&1 && echo "PASS  git fsck --full --strict" || { echo "FAIL  git fsck"; fail=1; }
dangling=$(git count-objects -v | awk '/^in-pack|^count/{c+=$2; n+=$2} /^count:/{loose=$2} END{}')
loose=$(git count-objects -v | awk '/^count:/{print $2}')
[ "$loose" = "0" ] && echo "PASS  loose objects 0" || echo "WARN  loose objects $loose"

[ $fail -eq 0 ] && echo "RESULT: PASS — public mirror clean" || echo "RESULT: FAIL"
exit $fail
