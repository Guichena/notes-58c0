#!/usr/bin/env python3
from bridge import run_original
run_original('tests/fixtures/remaining-practice-defects/verify_dist.py',[{
 'before':"assert sha(get(entries[r['entryId']],r['path']))==r['afterSha256'],('unapplied/dist drift',r['entryId'],r['path'])",
 'after':"assert sha(get(entries[r['entryId']],r['path']))==interruption_expected_leaf_hash(r['entryId'],r['path'],r['afterSha256']),('unapplied/dist drift',r['entryId'],r['path'])"
}])
