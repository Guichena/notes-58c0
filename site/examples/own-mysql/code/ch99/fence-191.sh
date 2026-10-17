cd components/application/code
curl --fail --location https://repo.maven.apache.org/maven2/com/h2database/h2/2.3.232/h2-2.3.232.jar --output h2-2.3.232.jar
python3 - <<'PYHASH'
from pathlib import Path
from hashlib import sha256
p = Path("h2-2.3.232.jar")
if sha256(p.read_bytes()).hexdigest() != "8dae62d22db8982c3dcb3826edb9c727c5d302063a67eef7d63d82de401f07d3":
    raise SystemExit("H2 hash mismatch; stop before running examples")
print("H2 dependency verified")
PYHASH
