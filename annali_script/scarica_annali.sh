#!/bin/sh
# Scarica gli annali idrologici Arpae (1916-2022) in annali/<anno>/
# Uso: sh scarica_annali.sh   (riprende i download interrotti)
cd "$(dirname "$0")" || exit 1
while read -r u; do
  y=$(echo "$u" | grep -oE 'idrologici-[0-9]+' | head -1 | sed 's/idrologici-//')
  f=$(basename "$u")
  mkdir -p "../annali/$y"
  echo "$y/$f"
  curl -L -C - --retry 5 -o "../annali/$y/$f" "$u"
done < elenco_link.txt
