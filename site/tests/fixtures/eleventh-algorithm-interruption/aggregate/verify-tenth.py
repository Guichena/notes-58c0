#!/usr/bin/env python3
"""Read-only actual-site gate. Fixture diagnostics never claim actual acceptance."""
import argparse,copy,json,pathlib,sys
from tenth_expected import *
ap=argparse.ArgumentParser();ap.add_argument('--site',type=pathlib.Path);ap.add_argument('--check-fixtures',action='store_true');a=ap.parse_args()
p,old,after=validate_tenth_proof()
if a.check_fixtures:
 negatives=[]
 for r in p['records']:
  bad=copy.deepcopy(p['originalEntries'][r['entryId']]);setleaf(bad,r['path'],r['after'])
  try:tenth_entry(bad)
  except AssertionError:negatives.append(r['entryId']+':'+str(r['path']))
  else:raise AssertionError('drifted expected entry was accepted')
 bad=copy.deepcopy(p['originalEntryOrder']);bad[0],bad[1]=bad[1],bad[0]
 try:tenth_order(bad)
 except AssertionError:negatives.append('ordered IDs')
 else:raise AssertionError('reordered original ids accepted')
 print(json.dumps(dict(status='PASS_PURE_PROOF_DIAGNOSTIC',fields=14,entries=9,registryBefore=527,registryAfter=541,negativeChecks=negatives,actualAcceptance=False,siteWrites=0)));sys.exit(0)
assert a.site is not None,'--site required; no fallback or synthesized dist'
site=a.site.resolve();assert_tenth_site(site)
print(json.dumps(dict(status='PASS_SUPPLIED_JOINT_SITE_INPUTS',site=str(site),fields=14,entries=9,corpusEntries=803,historicalStageRegistryRecords=541,currentRegistryRecords=558,validatedSuppliedSiteInputs=True,frozenPriorFixtures=len(p['frozenPriorFixtureHashes']),actualAcceptance=False,siteWrites=0)))
