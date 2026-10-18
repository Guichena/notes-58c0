#!/usr/bin/env python3
from bridge import run_original
run_original('tests/fixtures/agent-backend-relocation/verify-runtime.py',[{
 'before':"assert hashlib.sha256(s.encode()).hexdigest()==c['sha256'],c['name']+' final-dist implementation changed'",
 'after':"assert hashlib.sha256(s.encode()).hexdigest()==interruption_expected_source_hash(c['name'],c['sha256']),c['name']+' final-dist implementation changed'"
}])
