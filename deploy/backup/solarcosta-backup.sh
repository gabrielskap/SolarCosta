#!/usr/bin/env bash
#
# Backup do banco SolarCosta.
#
#   ./solarcosta-backup.sh              backup diário
#   ./solarcosta-backup.sh --verificar  só testa se o último dump está íntegro
#
# Formato custom (-Fc): comprimido, e o pg_restore consegue restaurar tabelas
# individuais a partir dele — coisa que um .sql puro não permite.
#
# Instalação: veja deploy/README.md

set -Eeuo pipefail

# ---------------------------------------------------------------- config ---
# Sobrescreva por variável de ambiente ou editando aqui.
PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5434}"
PGDATABASE="${PGDATABASE:-SolarCosta}"
PGUSER="${PGUSER:-postgres}"

DESTINO="${BACKUP_DIR:-/var/backups/solarcosta}"
LOG="${BACKUP_LOG:-/var/log/solarcosta-backup.log}"

# Retenção
MANTER_DIARIOS=7
MANTER_SEMANAIS=5
MANTER_MENSAIS=12

# ------------------------------------------------------------- utilidades ---
registrar() {
    printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$LOG"
}

falhar() {
    registrar "ERRO: $*"
    exit 1
}

# Qualquer comando que falhe cai aqui com a linha exata.
trap 'falhar "falha na linha $LINENO"' ERR

# ------------------------------------------------------------ verificação ---
verificar_dump() {
    local arquivo="$1"
    # pg_restore --list lê o índice do dump. Se o arquivo estiver truncado ou
    # corrompido, falha aqui — antes de você precisar dele numa emergência.
    if ! pg_restore --list "$arquivo" > /dev/null 2>&1; then
        return 1
    fi
    # Um dump do schema completo tem que mencionar as tabelas principais.
    local tabelas
    tabelas=$(pg_restore --list "$arquivo" | grep -c 'TABLE DATA public SolarCosta' || true)
    if [ "$tabelas" -lt 20 ]; then
        registrar "AVISO: dump tem só $tabelas tabelas SolarCosta_ (esperado ~36)"
        return 1
    fi
    return 0
}

if [ "${1:-}" = "--verificar" ]; then
    ultimo=$(find "$DESTINO" -name 'solarcosta-*.dump' -type f -printf '%T@ %p\n' 2>/dev/null \
             | sort -rn | head -1 | cut -d' ' -f2-)
    [ -n "$ultimo" ] || falhar "nenhum backup encontrado em $DESTINO"
    if verificar_dump "$ultimo"; then
        registrar "OK: $ultimo íntegro ($(du -h "$ultimo" | cut -f1))"
        exit 0
    fi
    falhar "$ultimo está corrompido"
fi

# ------------------------------------------------------------------ dump ---
mkdir -p "$DESTINO"/{diario,semanal,mensal}
chmod 700 "$DESTINO"

carimbo=$(date '+%Y%m%d-%H%M%S')
arquivo="$DESTINO/diario/solarcosta-$carimbo.dump"

registrar "iniciando backup de $PGDATABASE em $PGHOST:$PGPORT"

# A senha vem do ~/.pgpass (modo 600) — nunca da linha de comando, que ficaria
# visível para qualquer usuário rodando `ps`.
pg_dump \
    --host="$PGHOST" \
    --port="$PGPORT" \
    --username="$PGUSER" \
    --dbname="$PGDATABASE" \
    --format=custom \
    --compress=9 \
    --no-password \
    --file="$arquivo.parcial"

# Só vira arquivo definitivo depois de gravado por inteiro: se o processo
# morrer no meio, sobra um .parcial e nenhum backup falso-positivo.
mv "$arquivo.parcial" "$arquivo"
chmod 600 "$arquivo"

tamanho=$(du -h "$arquivo" | cut -f1)
registrar "dump gravado: $arquivo ($tamanho)"

# Backup que não restaura não é backup.
if verificar_dump "$arquivo"; then
    registrar "integridade conferida"
else
    falhar "dump gerado está corrompido — investigue antes da próxima execução"
fi

# -------------------------------------------------------------- rotação ---
# Domingo vira o semanal; dia 1 vira o mensal.
dia_semana=$(date '+%u')   # 1=segunda ... 7=domingo
dia_mes=$(date '+%d')

if [ "$dia_semana" = "7" ]; then
    cp -p "$arquivo" "$DESTINO/semanal/"
    registrar "cópia semanal criada"
fi

if [ "$dia_mes" = "01" ]; then
    cp -p "$arquivo" "$DESTINO/mensal/"
    registrar "cópia mensal criada"
fi

expurgar() {
    local pasta="$1" manter="$2"
    local total
    total=$(find "$pasta" -name '*.dump' -type f | wc -l)
    if [ "$total" -gt "$manter" ]; then
        find "$pasta" -name '*.dump' -type f -printf '%T@ %p\n' \
            | sort -n | head -n -"$manter" | cut -d' ' -f2- \
            | while read -r velho; do
                rm -f "$velho"
                registrar "expurgado: $(basename "$velho")"
              done
    fi
}

expurgar "$DESTINO/diario"  "$MANTER_DIARIOS"
expurgar "$DESTINO/semanal" "$MANTER_SEMANAIS"
expurgar "$DESTINO/mensal"  "$MANTER_MENSAIS"

# Limpa .parcial de execuções que morreram no meio.
find "$DESTINO" -name '*.parcial' -mtime +1 -delete 2>/dev/null || true

espaco=$(du -sh "$DESTINO" | cut -f1)
registrar "concluído · $espaco em $DESTINO"
