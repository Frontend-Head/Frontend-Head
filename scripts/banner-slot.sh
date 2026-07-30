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
hour=$((10#$hour)) # "07" ist sonst eine ungültige Oktalzahl

if [ "$hour" -ge 5 ] && [ "$hour" -le 9 ]; then
  echo morgen
elif [ "$hour" -ge 10 ] && [ "$hour" -le 16 ]; then
  echo tag
elif [ "$hour" -ge 17 ] && [ "$hour" -le 20 ]; then
  echo abend
else
  echo nacht
fi
