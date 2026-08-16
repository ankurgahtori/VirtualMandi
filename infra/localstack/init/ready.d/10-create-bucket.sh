#!/bin/sh
set -eu

BUCKET="${S3_BUCKET:-virtual-mandi-local}"
REGION="${AWS_DEFAULT_REGION:-ap-south-1}"

awslocal s3api head-bucket --bucket "$BUCKET" >/dev/null 2>&1 || \
  awslocal s3 mb "s3://$BUCKET" --region "$REGION"

echo "LocalStack S3 bucket ready: $BUCKET"
