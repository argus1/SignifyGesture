# EC2 deployment

The deployment uses a single Amazon Linux 2023 ARM64 `t4g.small` in `us-east-1`.
Node.js 22 runs the Nitro `node-server` build behind Caddy's automatically renewed
HTTPS certificate at **https://signify.hcavra.com**. Do not use Vite's development
server for team distribution.

## Infrastructure

[`deploy/ec2.yml`](../deploy/ec2.yml) defines the `signify-deployment` CloudFormation
stack: encrypted 20 GiB gp3 storage, an Elastic IP, HTTP/HTTPS ingress, an instance
role for Systems Manager and read-only deployment-artifact access, a private
encrypted S3 bucket, and the `signify-deployment-power` IAM user. There is no SSH
key or public SSH port. IMDSv2 is required. CPU credits use standard mode to
avoid unlimited-mode surplus charges.

Provisioning requires an appropriately authorized administrator. Prefer a
short-lived administrative role rather than root credentials:

```sh
aws cloudformation deploy --region us-east-1 \
  --stack-name signify-deployment --template-file deploy/ec2.yml \
  --parameter-overrides VpcId=<public-vpc-id> SubnetId=<public-subnet-id> \
    Hostname=signify.hcavra.com \
  --capabilities CAPABILITY_NAMED_IAM --tags Project=SignifyGesture
```

The subnet must route to an internet gateway. Before deploying a stack update,
review its change set, especially anything replacing the server or its disk.
The instance bootstraps Node and checksum-verified Caddy, installs hardened
systemd services, and marks readiness with `/opt/signify/bootstrap-complete`.

Read resource IDs without copying account details into source:

```sh
aws cloudformation describe-stacks --region us-east-1 \
  --stack-name signify-deployment --query 'Stacks[0].Outputs'
```

At Porkbun, create an **A** record for `signify` pointing to the stack's
`PublicIp` output. Do not change nameservers or other records. Do not create an
AAAA record unless IPv6 is separately configured. Public ports 80 and 443 are
needed for certificate issuance/renewal and HTTPS; HTTP redirects to HTTPS.

## Publish a release

Install the project's dependencies with its existing Bun lockfile first.
From the repository root, using an authorized AWS CLI session:

```sh
bash scripts/deploy-ec2.sh
```

The script builds the **current working tree** with `npm run build:ec2`, checks
that the output contains no platform-specific native modules, packages only
the production server and public assets, and uploads a checksum-verified archive
to the stack's private bucket. Never embed credentials or private data in
frontend source or `VITE_*` variables: browser bundles are public.

SSM installs a versioned release, atomically switches the current symlink,
restarts Node, and checks its local HTTP response before starting Caddy.
A failed local health check restores the preceding release when one exists
and reports failure. Public HTTPS checks cover `/`, `/messages`, `/community`,
and `/memory`. A failed DNS/TLS check is an error, not deployment success.
Artifact uploads expire after seven days; installed releases remain on disk.
Keep an eye on disk use and retain only releases needed for rollback.

Optional overrides are `AWS_REGION` and `SIGNIFY_STACK`. The publishing identity
needs CloudFormation output reads, artifact uploads, SSM Run Command, and command
status reads. The power-control user deliberately cannot publish or administer
the server.

For administration, use AWS Systems Manager Session Manager or Run Command.
Check `systemctl status signify caddy`, `journalctl -u signify -u caddy`, and
`/var/log/cloud-init-output.log` when diagnosing failures. Application and
proxy services start automatically when the instance starts; Caddy's
certificate state persists on the encrypted root volume.

## Power-control console user

The IAM user `signify-deployment-power` has Start/Stop permissions on **only this
stack's instance**. It cannot terminate, resize, SSH, invoke SSM, or change other
instances. EC2's read-only console inventory permissions cannot be scoped to
one instance, so other instance metadata in the account may be visible.
It can change only its own console password and read account password rules.

No password, access key, or login profile is created by the template. An account
administrator must open **IAM > Users > signify-deployment-power > Security
credentials > Enable console access**, set a password securely, and require a
password change on first sign-in. Do not send passwords in chat, store them in
the repository, or attach broader managed policies to this user.

Select **N. Virginia (`us-east-1`)** in the EC2 console, select the
`signify-deployment` instance, and choose **Instance state > Stop instance** or
**Start instance**. Stopping makes the app unavailable to the team. Its Elastic
IP remains stable across stops/starts.

An authorized AWS CLI identity can alternatively run:

```sh
aws ec2 stop-instances --region us-east-1 --instance-ids <InstanceId-output>
aws ec2 start-instances --region us-east-1 --instance-ids <InstanceId-output>
```

Compute charges stop when the instance is stopped, but EBS, the reserved public
IPv4 address, and stored S3 artifacts continue to incur charges. This is a
single-instance deployment, not high availability. Do not delete the stack
without reviewing the loss of the server disk and power user; the artifact
bucket is intentionally retained.

## iOS distribution

Release builds use `https://signify.hcavra.com` from
`iOSApp/Config/Frontend.xcconfig`, even when the ignored `Local.xcconfig` sets a
developer LAN URL for Debug. To use the deployment in Debug as well, set the
ignored `iOSApp/Config/Local.xcconfig` override to:

```xcconfig
SIGNIFY_FRONTEND_URL = https:/$()/signify.hcavra.com
```

Regenerate the Xcode project, create a **new** Release archive, and verify
`com.argussun.signifygesture2` before TestFlight upload. An existing archive
retains its previously compiled frontend URL. Follow the
[native runbook](NATIVE_IOS_RUNBOOK.md#testflight-bundle-identity).
