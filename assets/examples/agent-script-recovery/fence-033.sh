java -cp classes ScriptService request http://127.0.0.1:12345 /submit '{"id":"demo1","template":"sum-v1","input":[1,2,3],"ttlMillis":60000}'
java -cp classes ScriptService worker http://127.0.0.1:12345 worker1
java -cp classes ScriptService request http://127.0.0.1:12345 /get '{"id":"demo1"}'
