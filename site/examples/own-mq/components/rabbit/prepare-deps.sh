#!/bin/sh
set -eu
mkdir -p build
curl -fL --max-time 30 https://repo.maven.apache.org/maven2/com/rabbitmq/amqp-client/5.26.0/amqp-client-5.26.0.jar -o build/amqp-client-5.26.0.jar
curl -fL --max-time 30 https://repo.maven.apache.org/maven2/org/slf4j/slf4j-api/2.0.17/slf4j-api-2.0.17.jar -o build/slf4j-api-2.0.17.jar
sha256sum -c dependencies.sha256
