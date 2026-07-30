#!/bin/sh
# Gibt den Tageszeit-Slot für eine Stunde aus - Standard ist die aktuelle
# Berliner Stunde. Liegt als eigenes Skript vor, damit die Zuordnung ohne
# Workflow-Lauf prüfbar ist:
#
#   sh scripts/banner-slot.sh      -> Slot für jetzt
#   sh scripts/banner-slot.sh 19   -> abend
#
# Europe/Berlin erledigt die Sommer-/Winterzeit, deshalb kein eigener Offset.

hour=${1:-$(TZ=Europe/Berlin date +%H)}

# Führende Null weg, bevor gerechnet wird: "07" wäre in der Arithmetik eine
# ungültige Oktalzahl. Die naheliegende Schreibweise $((10#$hour)) ist eine
# Bash-Erweiterung - auf den Runnern ist /bin/sh aber dash, und die bricht damit
# ab. Deshalb POSIX-Parameterexpansion.
hour=${hour#0}
[ -n "$hour" ] || hour=0 # "00" wird durch das Abschneiden zu ""

if [ "$hour" -ge 5 ] && [ "$hour" -le 9 ]; then
  echo morgen
elif [ "$hour" -ge 10 ] && [ "$hour" -le 16 ]; then
  echo tag
elif [ "$hour" -ge 17 ] && [ "$hour" -le 20 ]; then
  echo abend
else
  echo nacht
fi
