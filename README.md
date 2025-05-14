 # x402 Solana RPC Demo

 This repository demonstrates how to deploy a Solana RPC node on AWS using [SVMKit](https://github.com/abklabs/svmkit) and monetize API access using the [x402](https://x402.org) protocol with on-chain USDC payments.

 ## Prerequisites
 - Node.js >=16
 - npm
 - [Pulumi CLI](https://www.pulumi.com/docs/get-started/install/)
 - AWS credentials configured (e.g., via `~/.aws/credentials`)
 - Solana CLI (optional, for manual token operations)

 ## Project Structure
 ```
 x402-solana-rpc-demo/
 ├── README.md
 ├── pulumi/
 │   ├── index.ts         # Pulumi program to launch Agave RPC node on AWS
 │   ├── Pulumi.yaml      # Pulumi project config
 │   ├── package.json     # Node dependencies for Pulumi program
 │   └── tsconfig.json    # TypeScript config
 ├── x402/
 │   ├── config.json      # Pricing & token config ($1 USDC per request)
 │   └── facilitator.ts   # x402 facilitator implementation
 └── server/
     ├── rpc-proxy.ts     # RPC proxy server with payment validation
     ├── package.json     # Node dependencies for proxy server
     └── tsconfig.json    # TypeScript config
 ```

 ## Demo Flow
1. **Deploy infrastructure on AWS**
    ```bash
    cd pulumi
    npm install
    pulumi stack init dev
    pulumi config set aws:region us-east-1
    pulumi config set solana:network Devnet
    pulumi config set validator:version 2.1.13-1
    pulumi config set node:instanceType t3.medium
    pulumi config set node:instanceArch x86_64
    pulumi up --yes
    ```
    After deployment, retrieve your outputs:
    ```bash
    # From the project root, change into the Pulumi directory
    cd pulumi
    # Retrieve the RPC endpoint and validator info
    export RPC_ENDPOINT=$(pulumi stack output rpcEndpoint)
    export VALIDATOR_IP=$(pulumi stack output validatorPublicIp)
    # Retrieve the Base64-encoded private key
    export VALIDATOR_KEY_B64=$(pulumi stack output --cwd pulumi --show-secrets validatorPrivateKeyBase64)
    # Return to the project root
    cd ..
    ```
    You can SSH into your node for further debugging:
    ```bash
    # Decode and save the private key and set permissions
    echo "$VALIDATOR_KEY_B64" | base64 --decode > validator-key.pem
    chmod 600 validator-key.pem
    # SSH into the instance; try 'admin' or 'debian' as username
    ssh -i validator-key.pem admin@$VALIDATOR_IP  || ssh -i validator-key.pem debian@$VALIDATOR_IP
    ```
    Once connected, verify the Agave RPC is listening:
    ```bash
    # Check that port 8899 is bound
    sudo ss -tln | grep 8899
    # Or test a local JSON-RPC call:
    curl -X POST http://127.0.0.1:8899 -H "Content-Type: application/json" \
      -d '{"jsonrpc":"2.0","id":1,"method":"getSlot","params":[]}'
    ```
    If it is not listening or errors, inspect the service logs. SVMKit may register the validator under different service names:
    ```bash
    sudo journalctl -u agave -f                  # SVMKit might use 'agave'
    sudo journalctl -u svmkit-validator -f       # or 'svmkit-validator'
    sudo journalctl -u validator -f             # or simply 'validator'
    ```
    If no logs appear, list all services to find the correct unit:
    ```bash
    systemctl list-units --type=service --all | grep -E 'agave|svmkit|validator'
    ```
    Also check for a running solana-validator process:
    ```bash
    ps aux | grep solana-validator
    ```
    If SVMKit uses Docker, list containers:
    ```bash
    docker ps
    ```
    And inspect /var/log for any SVMKit or Agave logs:
    ```bash
    ls /var/log | grep -E 'agave|svmkit'
    ```
    Also ensure the AWS Security Group allows inbound TCP/8899.
    You can manually add the rules via AWS CLI:
    ```bash
    # Get the Security Group ID
    SG_ID=$(pulumi --cwd pulumi stack output validatorSecurityGroupId)
    # Allow RPC port
    aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 8899 --cidr 0.0.0.0/0
    # Allow repair port
    aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 8900 --cidr 0.0.0.0/0
    aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol udp --port 8900 --cidr 0.0.0.0/0
    # Allow gossip port
    aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 8001 --cidr 0.0.0.0/0
    aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol udp --port 8001 --cidr 0.0.0.0/0
    ```
2. **Configure payment settings**
    Use the TypeScript bootstrap script to:
    - generate (or reuse) a fee-payer keypair at `payer-keypair.json`
    - airdrop SOL (unless skipped)
    - create a new SPL token mint (6 decimals)
    - create an associated token account for the payer
    - mint 1 USDC to the payer’s ATA
    - generate a new recipient keypair at `recipient-keypair.json`
    - create an associated token account for the recipient
    - update `x402/config.json` with the new `mint` and recipient public key

    ```bash
    cd x402-solana-rpc-demo
    npm install
    npm run bootstrap
    ```
    To skip the SOL airdrop (if you already have Devnet SOL):
    ```bash
    SKIP_AIRDROP=1 npm run bootstrap
    ```
 3. **Start the RPC proxy server**
    ```bash
    cd server
    npm install
    npm start    # automatically fetches RPC_ENDPOINT from Pulumi
    ```
 4. **Send payment and query slot**
    - Send 1 USDC to the `recipient` address on Devnet and obtain the transaction signature (e.g., `TX_SIG`).
    - Call the endpoint with payment signature:
      ```bash
      curl "http://localhost:3000/get-slot?txSig=TX_SIG"
      ```
    You should receive a JSON response with the current slot:
    ```json
    {"jsonrpc":"2.0","result":12345678,"id":1}
    ```
## Bonus: Client Script

A Node.js script to automate sending $1 USDC and querying the slot.

```bash
cd client
npm install
export PAYER_KEYPAIR_PATH=/path/to/your/payer/keypair.json
export PROXY_URL=http://localhost:3000
npm start
```

Ensure `PAYER_KEYPAIR_PATH` points to your Solana wallet keypair file (e.g., `~/.config/solana/id.json`). The script will:
1. Send 1 USDC to the `recipient` in `x402/config.json`.
2. Wait for confirmation of the payment transaction.
3. Call the `/get-slot` endpoint with the transaction signature.
4. Print out the RPC response JSON.