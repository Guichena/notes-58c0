javac --release 17 -encoding UTF-8 -d out src/ApiLogCli.java tests/ApiLogCliTest.java
java -cp out ApiLogCliTest
java -cp out ApiLogCli --input requests.csv --output report.csv \
  --from 2026-10-11T00:00:00Z --to 2026-10-11T00:02:00Z \
  --window-seconds 60 --error-threshold 0.5 --max-groups 10000
