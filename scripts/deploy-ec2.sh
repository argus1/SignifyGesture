#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
region="${AWS_REGION:-us-east-1}"
stack="${SIGNIFY_STACK:-signify-deployment}"
[[ "$region" =~ ^[a-z]{2}-[a-z]+-[0-9]+$ ]] || { echo "Invalid AWS_REGION" >&2; exit 1; }
[[ "$stack" =~ ^[a-zA-Z][a-zA-Z0-9-]*$ ]] || { echo "Invalid SIGNIFY_STACK" >&2; exit 1; }

output() {
  aws cloudformation describe-stacks --region "$region" --stack-name "$stack" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue | [0]" --output text --no-cli-pager
}
instance="$(output InstanceId)"
bucket="$(output ArtifactsBucket)"
site="$(output SiteUrl)"
[[ "$instance" =~ ^i-[a-f0-9]+$ ]] || { echo "Missing instance output" >&2; exit 1; }
[[ "$bucket" =~ ^[a-z0-9][a-z0-9.-]+$ ]] || { echo "Missing artifacts bucket output" >&2; exit 1; }
[[ "$site" =~ ^https://[a-z0-9][a-z0-9.-]+$ ]] || { echo "Invalid site URL" >&2; exit 1; }

npm run build:ec2
test -f .output/server/index.mjs
if [[ -n "$(find .output -name '*.node' -print -quit)" ]]; then
  echo "Native modules found: build on Linux ARM64 before deploying." >&2
  exit 1
fi

temporary="$(mktemp -d)"
trap 'rm -f "$temporary/release.tar.gz" "$temporary/parameters.json"; rmdir "$temporary"' EXIT
release="$(date -u +%Y%m%dT%H%M%SZ)-$$"
COPYFILE_DISABLE=1 tar --no-xattrs --no-acls -czf "$temporary/release.tar.gz" -C .output server public
checksum="$(shasum -a 256 "$temporary/release.tar.gz" | cut -d ' ' -f 1)"
key="releases/$release.tar.gz"
aws s3 cp "$temporary/release.tar.gz" "s3://$bucket/$key" \
  --region "$region" --sse AES256 --only-show-errors --no-cli-pager

node --input-type=module - "$bucket" "$key" "$release" "$checksum" "$region" > "$temporary/parameters.json" <<'JS'
const [bucket, key, release, checksum, region] = process.argv.slice(2);
const script = `#!/bin/bash
set -euo pipefail
test -f /opt/signify/bootstrap-complete
exec 9>/run/signify-deploy.lock
flock -n 9
archive="$(mktemp /tmp/signify-release.XXXXXX.tar.gz)"
trap 'rm -f "$archive"' EXIT
aws s3 cp 's3://${bucket}/${key}' "$archive" --region '${region}' --only-show-errors
echo '${checksum}  '"$archive" | sha256sum -c -
install -d '/opt/signify/releases/${release}'
tar -xzf "$archive" -C '/opt/signify/releases/${release}'
test -f '/opt/signify/releases/${release}/server/index.mjs'
chown -R root:signify '/opt/signify/releases/${release}'
chmod -R u=rwX,g=rX,o= '/opt/signify/releases/${release}'
previous="$(readlink /opt/signify/current || true)"
ln -s '/opt/signify/releases/${release}' /opt/signify/next
mv -Tf /opt/signify/next /opt/signify/current
systemctl restart signify
ready=false
for attempt in $(seq 1 30); do
  if curl --fail --silent http://127.0.0.1:3000/ -o /dev/null; then ready=true; break; fi
  sleep 1
done
if [ "$ready" != true ]; then
  journalctl -u signify -n 50 --no-pager
  if [ -n "$previous" ]; then
    ln -s "$previous" /opt/signify/rollback
    mv -Tf /opt/signify/rollback /opt/signify/current
    systemctl restart signify
  fi
  echo 'Deployment failed its local health check' >&2
  exit 1
fi
systemctl start caddy
systemctl is-active signify caddy
`;
console.log(JSON.stringify({commands: [script], executionTimeout: ["300"]}));
JS
command_id="$(aws ssm send-command --region "$region" --instance-ids "$instance" \
  --document-name AWS-RunShellScript --parameters "file://$temporary/parameters.json" \
  --comment "Deploy SignifyGesture $release" --query Command.CommandId --output text --no-cli-pager)"
echo "SSM deployment command: $command_id"
if ! aws ssm wait command-executed --region "$region" --command-id "$command_id" --instance-id "$instance"; then
  aws ssm get-command-invocation --region "$region" --command-id "$command_id" --instance-id "$instance" --no-cli-pager
  exit 1
fi
aws ssm get-command-invocation --region "$region" --command-id "$command_id" --instance-id "$instance" \
  --query '{Status:Status,Output:StandardOutputContent,Errors:StandardErrorContent}' --no-cli-pager
for path in / /messages /community /memory; do
  curl --fail --silent --show-error --proto '=https' \
    --connect-timeout 10 --max-time 30 --retry 12 --retry-delay 5 \
    --retry-max-time 120 --retry-all-errors "$site$path" -o /dev/null
  echo "Verified $site$path"
done
