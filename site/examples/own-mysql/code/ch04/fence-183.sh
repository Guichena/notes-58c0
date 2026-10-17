#!/usr/bin/env bash
set -euo pipefail
: "${JAVA_HOME:?Set JAVA_HOME to a JDK supported by the selected HBase 2.5 release}"
: "${HBASE_HOME:?Set HBASE_HOME to an already installed official HBase 2.5 distribution}"
# Put hbase-site.xml in the distribution's conf directory after reviewing its local paths.
"$HBASE_HOME/bin/start-hbase.sh"
trap '"$HBASE_HOME/bin/stop-hbase.sh"' EXIT
"$HBASE_HOME/bin/hbase" shell <<'HBASE'
status
create 'interview_trace', 'event'
put 'interview_trace', 'tenant7:trace1:0001', 'event:body', 'start'
put 'interview_trace', 'tenant7:trace1:0002', 'event:body', 'finish'
get 'interview_trace', 'tenant7:trace1:0001'
scan 'interview_trace', {STARTROW=>'tenant7:trace1:', STOPROW=>'tenant7:trace2:', COLUMNS=>['event:body'], LIMIT=>10}
HBASE
# This shell example uses readable strings; Java TraceRowKey has a different binary contract.
