#!/usr/bin/env bash
set -euo pipefail

# Navigate to Pulumi folder and re-deploy with correct settings
pushd pulumi
echo "Deploying validator with open ports & no port-check..."
pulumi up --yes
popd

# Retrieve outputs
export RPC_URL=$(pulumi --cwd pulumi stack output rpcEndpoint)
export VALIDATOR_IP=$(pulumi --cwd pulumi stack output validatorPublicIp)
export VALIDATOR_KEY_B64=$(pulumi --cwd pulumi stack output --show-secrets validatorPrivateKeyBase64)

echo "RPC endpoint: $RPC_URL"
HOST=${RPC_URL#http://}; IP=${HOST%:*}

echo "Testing network connectivity to validator..."
nc -vz  $IP 8899 || echo "TCP 8899 refused"
nc -vzu $IP 8900 || echo "UDP 8900 refused"
nc -vz  $IP 8900 || echo "TCP 8900 refused"
nc -vzu $IP 8001 || echo "UDP 8001 refused"
nc -vz  $IP 8001 || echo "TCP 8001 refused"

echo "Decoding SSH key..."
echo "$VALIDATOR_KEY_B64" | base64 --decode > validator-key.pem
chmod 600 validator-key.pem

echo "SSHing into validator ($VALIDATOR_IP)..."
ssh -i validator-key.pem -o StrictHostKeyChecking=no admin@$VALIDATOR_IP 2>/dev/null \
  || ssh -i validator-key.pem -o StrictHostKeyChecking=no debian@$VALIDATOR_IP << 'EOF'
  set -e
  echo "=== Validator service status ==="
  sudo systemctl status svmkit-agave-validator.service || true
  echo
  echo "=== Last 50 logs ==="
  sudo journalctl -u svmkit-agave-validator.service --no-pager -n 50 || true
  echo
  echo "=== Listening tcp ports ==="
  sudo ss -tln | grep -E '8899|8900|8001' || echo "No ports bound"
  echo
  echo "=== Local RPC test ==="
  curl -s -X POST http://127.0.0.1:8899 \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":1,"method":"getSlot","params":[]}' || echo "Local RPC failed"
EOF