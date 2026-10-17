export ES_URL='https://localhost:9200'
export ES_CA_CERT='/path/to/http_ca.crt'
export ES_INDEX='interview_java_demo'
export ES_DEMO_ALLOW_CREATE='yes'
mvn -q -DskipTests package
mvn -q exec:java
