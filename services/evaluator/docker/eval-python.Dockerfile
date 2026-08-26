FROM python:3.12-slim
WORKDIR /opt/agentforge-eval
COPY fixtures/eval/broken-orders-api/environment/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
