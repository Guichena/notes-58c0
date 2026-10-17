import json,hashlib,re
from pathlib import Path
p=Path(__file__).parent;h=lambda b:hashlib.sha256(b).hexdigest();load=lambda f:json.loads((p/f).read_text())
entries=load('composed-entries.json');cat={e['id']:e for e in json.loads(Path('site/notes-58c0-refactor/dist/data/catalog.json').read_text())['entries']}
for r in load('link-checks.json'):
 bits=r['href'][4:].split('?')[0].split('#')[0].split('/')
 if len(bits)>1:
  e=next(e for e in json.loads((Path('site/notes-58c0-refactor/dist')/cat[bits[0]]['_chunk']).read_text())['entries']if e['id']==bits[0]);assert bits[1] in [q['id']for q in e.get('items',[])],r
for k,e in entries.items():
 rendered=(p/'rendered'/f'{k}-rendered.html').read_text()
 if e.get('readingNotesHtml'):assert e['readingNotesHtml'] in rendered
(p/'source-receipts.md').write_text('''# Backend 11 independent receipts, 2026-10-15
Full candidate text read across all 12 entries and 35 questions, including authored leads, unchanged siblings, network source guide and entire transport supplement. Original source spans read; 9 leaves composed against original guards. All four source archives rehashed. Current live catalog, not stale preflight, is authoritative: own-network-source-guide intentionally differs from the old preflight.

## Primary checks
- https://raw.githubusercontent.com/google/leveldb/1.23/doc/log_format.md exact tag: 32KiB blocks, seven-byte header, little-endian lengths/checksums, zero trailer and exactly-seven-byte empty FIRST exception. The teaching protocol remains distinct.
- https://raw.githubusercontent.com/python/cpython/v3.12.0/Doc/library/sqlite3.rst exact tag: memory-only database, LEGACY_TRANSACTION_CONTROL and explicit file-backed reopen example. Memory persistence is not restart persistence.
- https://raw.githubusercontent.com/django/django/5.2/django/db/models/query.py release tag: bulk_create list conversion and multi-table inheritance rejection; https://docs.djangoproject.com/en/5.2/ref/models/querysets/ family docs explain skipped save/signals. No ORM runtime test.
- https://dev.mysql.com/doc/refman/8.4/en/forcing-innodb-recovery.html family docs: rescue scope and permanent-corruption risk at 4+; not a patch-8.4.0 runtime certification.
- https://docs.spring.io/spring-framework/docs/6.2.x/javadoc-api/org/springframework/transaction/support/TransactionSynchronization.html currently 6.2.19: afterCommit runs after commit, old resources may remain bound but no further commit follows; separate transaction required. Exact 6.2.0 raw retrieval failed, so no exact historical patch certification.
- https://www.elastic.co/guide/en/elasticsearch/reference/8.19/docs-index_.html: strict external versus external_gte; equal-version conflict must not be universally ignored.
- https://debezium.io/documentation/reference/3.3/connectors/mysql.html: version-scoped connector snapshot/binlog contract; actual deployment/configuration untested.
- https://redis.io/docs/latest/operate/oss_and_stack/stack-with-enterprise/release-notes/redisearch/redisearch-2.10-release-notes/: 2.10.31 minimum Redis database 7.4 and Enterprise cluster 7.8; 7.2.0 is not asserted compatible.
- https://www.rfc-editor.org/rfc/rfc9293.html, https://www.rfc-editor.org/rfc/rfc9000.html, https://www.rfc-editor.org/rfc/rfc8446.html, https://www.rfc-editor.org/rfc/rfc9110.html: stable named protocol specifications retained; implementation defaults remain qualified.
- https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/nio/Buffer.html and https://man7.org/linux/man-pages/man7/epoll.7.html: buffer state and ET readiness boundaries for added theory paragraphs; current Linux man page is not v6.12 source certification.

## Extra composition
17 exact edits restore Arrays.copyOf example, remove four duplicate unanchored headings, make 36-source index availability honest, qualify complete-program headings, fill eight topic-only appendix sections with concrete mechanisms, and add source/execution limits. Existing algorithm bounds, arithmetic, examples, filenames, original IDs, anchors, links, images and code blocks retained. All numeric sets retained per changed leaf. Original author spans and block retention remain in input; composed exact offsets are separate.

## Evidence limits
37 actual compiled card/doc cases plus all 12 full renderQA/renderDoc outputs passed in isolated lightweight Node VM; appended transport prose included verbatim. Helpers unrelated to body rendering stubbed. All 76 local route targets and referenced question IDs checked. No browser layout/full-site regression, JVM, database, socket service or fault-injection execution; no missing runnable program invented or certified. Integration remains owned by parent.
''')
m=dict(batch='backend-11',status='approved-narrow-with-explicit-source-bounds',entries=12,questions=35,approvedLeaves=9,additionalCompositionEdits=17,approvedArtifact='approved-leaves.json',approvedArtifactSha256=h((p/'approved-leaves.json').read_bytes()),coverage='All candidate prose, leads, siblings and supplements read; original exact spans checked. Original guarded leaves retained with separate extra spans.',checks='Frozen input SHA256; current live guards; four archive SHA256; numeric/link/anchor/image/code retention; 76 routes with question IDs; 37 card/doc cases and 12 complete entry renders.',limits=['No browser visual or full-site suite.','No database/JVM/network-service/fault-injection execution.','Missing runnable sources remain explicit; family documentation does not certify all historical patch behavior.'],files={str(f.relative_to(p)):h(f.read_bytes())for f in sorted(p.rglob('*'))if f.is_file() and f.name!='composition-manifest.json'})
(p/'composition-manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2));print(m['approvedArtifactSha256'])
