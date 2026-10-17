mkdir -p deps
curl --fail --location --proto '=https' --tlsv1.2 \
  'https://repo.maven.apache.org/maven2/com/h2database/h2/2.3.232/h2-2.3.232.jar' \
  --output deps/h2-2.3.232.jar.part
python3 - <<'PYH2'
import hashlib
from pathlib import Path
p = Path('deps/h2-2.3.232.jar.part')
expected = '8dae62d22db8982c3dcb3826edb9c727c5d302063a67eef7d63d82de401f07d3'
if hashlib.sha256(p.read_bytes()).hexdigest() != expected:
    raise SystemExit('H2 SHA-256 mismatch; dependency was not installed')
p.replace('deps/h2-2.3.232.jar')
PYH2
bash run-all.sh
