import hashlib,json,pathlib,tarfile,tempfile,shutil
root=pathlib.Path.cwd(); base=root/'.release'; m=json.loads((base/'manifest.json').read_text()); expected={r['path']:r for r in m['files']}
def digest(b):return hashlib.sha256(b).hexdigest()
with tempfile.TemporaryDirectory(prefix='notes-release-') as tmp:
 tmp=pathlib.Path(tmp); archive=tmp/'changes.tar.xz'
 with archive.open('wb') as out:
  for part in m['parts']:
   name=part['name']
   if pathlib.PurePosixPath(name).name!=name:raise ValueError('Unsafe part path')
   b=(base/name).read_bytes()
   if len(b)!=part['size'] or digest(b)!=part['sha256']:raise ValueError('Part integrity failure: '+name)
   out.write(b)
 if archive.stat().st_size!=m['size'] or digest(archive.read_bytes())!=m['sha256']:raise ValueError('Archive integrity failure')
 stage=tmp/'stage';stage.mkdir()
 with tarfile.open(archive,'r:xz') as tar:
  members=tar.getmembers();seen=set()
  for info in members:
   name=info.name;p=pathlib.PurePosixPath(name)
   if not info.isfile() or p.is_absolute() or '..' in p.parts or p.parts[0] in ('.git','.github','.release') or name in seen or name not in expected:raise ValueError('Unexpected archive member: '+name)
   seen.add(name);b=tar.extractfile(info).read();want=expected[name]
   if len(b)!=want['size'] or digest(b)!=want['sha256']:raise ValueError('File integrity failure: '+name)
   dest=stage/name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(b)
  if seen!=set(expected):raise ValueError('Missing archive members')
 for name in m.get('deletes',[]):
  p=pathlib.PurePosixPath(name)
  if p.is_absolute() or '..' in p.parts or p.parts[0] in ('.git','.github','.release') or name in expected:raise ValueError('Unsafe deletion: '+name)
  target=root/name
  if target.is_symlink() or (target.exists() and not target.is_file()):raise ValueError('Unsafe deletion target')
  target.unlink(missing_ok=True)
 for name in sorted(expected):
  dest=root/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(stage/name,dest)
 print('Restored and verified',len(expected),'files')
# Only remove the one-time transport directory; source files and Git history remain.
shutil.rmtree(base)
