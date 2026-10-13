#!/bin/sh
# Assemble the page from its parts.
set -e
OUT=future-city-builder.html
{ cat part1.html part2.html; echo '<script>'; cat ../ledger/model.js engine.js clock.js ui.js; echo '</script>'; } > "$OUT"
{ echo '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>body{margin:0;font:14px system-ui}[hidden]{display:none!important}img{max-width:100%}</style></head><body>'; cat "$OUT"; echo '</body></html>'; } > preview.html
wc -c "$OUT"
