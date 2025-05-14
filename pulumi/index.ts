import * as pulumi from "@pulumi/pulumi";
import { Buffer } from "buffer";
import * as aws from "@pulumi/aws";
import * as tls from "@pulumi/tls";
import * as svmkit from "@svmkit/pulumi-svmkit";

// Configuration
const nodeConfig = new pulumi.Config("node");
const validatorConfig = new pulumi.Config("validator");
const solanaConfig = new pulumi.Config("solana");
const tunerConfig = new pulumi.Config("tuner");

const instanceType = nodeConfig.get("instanceType") ?? "t3.medium";
const instanceArch = nodeConfig.get("instanceArch") ?? "x86_64";
const agaveVersion = validatorConfig.get("version") ?? "2.1.13-1";
const networkName = (solanaConfig.get("network") as svmkit.solana.NetworkName) ??
  svmkit.solana.NetworkName.Devnet;
const tunerVariant = (tunerConfig.get("variant") as svmkit.tuner.TunerVariant) ??
  svmkit.tuner.TunerVariant.Generic;

// AWS: SSH key and EC2 instance
const sshKey = new tls.PrivateKey("ssh-key", { algorithm: "ED25519" });
const keyPair = new aws.ec2.KeyPair("validator-keypair", {
  publicKey: sshKey.publicKeyOpenssh,
});
const ami = pulumi.output(
  aws.ec2.getAmi({
    filters: [
      { name: "name", values: ["debian-12-*"] },
      { name: "architecture", values: [instanceArch] },
    ],
    owners: ["136693071363"],
    mostRecent: true,
  })
).id;
const securityGroup = new aws.ec2.SecurityGroup("validator-sg", {
  description: "Allow SSH and RPC traffic",
  // Temporarily allow all inbound for validator (debug); restrict later once verified
  ingress: [
    { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] },
  ],
  egress: [{ protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] }],
});
// Export the Security Group ID so it can be manually modified if needed
export const validatorSecurityGroupId = securityGroup.id;
const instance = new aws.ec2.Instance("validator-instance", {
  ami,
  instanceType,
  // Ensure the instance receives a public IP for SSH and RPC access
  associatePublicIpAddress: true,
  keyName: keyPair.keyName,
  vpcSecurityGroupIds: [securityGroup.id],
  ebsBlockDevices: [
    { deviceName: "/dev/sdf", volumeSize: 500, volumeType: "io2", iops: 16000 },
    { deviceName: "/dev/sdg", volumeSize: 1024, volumeType: "io2", iops: 16000 },
  ],
  userData: `#!/bin/bash
mkfs -t ext4 /dev/sdf
mkfs -t ext4 /dev/sdg
mkdir -p /home/sol/accounts
mkdir -p /home/sol/ledger
cat <<EOF >> /etc/fstab
/dev/sdf   /home/sol/accounts  ext4  defaults  0 0
/dev/sdg   /home/sol/ledger    ext4  defaults  0 0
EOF
systemctl daemon-reload
mount -a
`,
  tags: { Name: `${pulumi.getStack()}-validator` },
});

// Solana network info
const networkInfo = svmkit.networkinfo.getNetworkInfoOutput({ networkName });
// Keypairs for validator identity and vote account
const validatorKey = new svmkit.KeyPair("validator-key");
const voteAccountKey = new svmkit.KeyPair("vote-account-key");

// Tuner to optimize instance
const tunerParams = svmkit.tuner
  .getDefaultTunerParamsOutput({ variant: tunerVariant })
  .apply((p) => ({ cpuGovernor: p.cpuGovernor, kernel: p.kernel, net: p.net, vm: p.vm, fs: p.fs }));
const connection = {
  host: instance.publicDns,
  user: "admin",
  privateKey: sshKey.privateKeyOpenssh,
};
new svmkit.tuner.Tuner("tuner", { connection, params: tunerParams }, { dependsOn: [instance] });

// Launch Agave validator with JSON RPC
const rpcPort = 8899;
new svmkit.validator.Agave(
  "validator",
  {
    connection,
    version: agaveVersion,
    environment: { rpcURL: networkInfo.rpcURL[0] },
    keyPairs: { identity: validatorKey.json, voteAccount: voteAccountKey.json },
    flags: {
      // Disable internal port-reachability checks so the validator can start even if peer ports aren't reachable
      extraFlags: ["--no-port-check"],
      useSnapshotArchivesAtStartup: "when-newest",
      fullRpcAPI: false,
      rpcPort,
      privateRPC: true,
      onlyKnownRPC: false,
      dynamicPortRange: "8002-8020",
      gossipPort: 8001,
      rpcBindAddress: "0.0.0.0",
      walRecoveryMode: "skip_any_corrupted_record",
      limitLedgerSize: 50000000,
      blockProductionMethod: "central-scheduler",
      fullSnapshotIntervalSlots: 1000,
      noWaitForVoteToStartLeader: true,
      noVoting: true,
      entryPoint: networkInfo.entryPoint,
      knownValidator: networkInfo.knownValidator,
      expectedGenesisHash: networkInfo.genesisHash,
    },
    // Don't wait for RPC port health on startup
    startupPolicy: { waitForRPCHealth: false },
  },
  { dependsOn: [instance] }
);

// Export the RPC endpoint for use by proxy
export const rpcEndpoint = pulumi.interpolate`http://${instance.publicIp}:${rpcPort}`;
// Export instance connection info for SSH debugging
export const validatorPublicIp = instance.publicIp;
// Export raw OpenSSH private key for SSH access (secret), may contain newlines
export const validatorPrivateKey = sshKey.privateKeyOpenssh;
// Additionally, export Base64-encoded private key to preserve formatting
export const validatorPrivateKeyBase64 = sshKey.privateKeyOpenssh.apply(pk => Buffer.from(pk).toString("base64"));